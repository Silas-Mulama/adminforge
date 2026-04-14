import { supabase } from './supabase';
import { parseSchema, generateDashboardConfig } from './schema-engine';

function normalizeSchema(project) {
  if (project.config && project.config.models) {
    return project.config;
  }

  if (project.parsed_config && project.parsed_config.models) {
    return project.parsed_config;
  }

  if (project.schema && project.schema.models) {
    return project.schema;
  }

  return null;
}

async function resolveSchema(project) {
  const normalized = normalizeSchema(project);
  if (normalized) {
    return normalized;
  }

  if (typeof project.raw_schema === 'string') {
    try {
      const parsed = JSON.parse(project.raw_schema);
      if (parsed && parsed.models) {
        return parsed;
      }
    } catch (_) {
      // raw_schema is not JSON; we'll fall through to parser if inputType exists
    }

    if (project.inputType) {
      return await parseSchema(project.raw_schema, project.inputType);
    }
  }

  throw new Error('Unable to resolve project schema for export.');
}

export async function exportProject(projectId, projectName) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error('Authentication failed.');
  }

  const user = sessionData?.session?.user;
  if (!user) {
    throw new Error('User must be signed in to export.');
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError) {
    throw new Error(`Project query failed: ${projectError.message || JSON.stringify(projectError)}`);
  }

  if (!project) {
    throw new Error('Project not found.');
  }

  const workspaceId = project.workspace_id ?? project.workspaceId;
  if (!workspaceId) {
    throw new Error('Project workspace not found.');
  }

  let authorized = false;

  if (project.created_by === user.id || project.owner_id === user.id || project.user_id === user.id) {
    authorized = true;
  }

  if (!authorized) {
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (membershipError) {
      const errorMessage = membershipError.message || JSON.stringify(membershipError);
      if (errorMessage.toLowerCase().includes('relation "memberships" does not exist') || errorMessage.includes('42P01')) {
        // Memberships table is not present; fallback to project ownership/creator check.
        authorized = false;
      } else {
        throw new Error(`Authorization check failed: ${errorMessage}`);
      }
    } else if (membership) {
      authorized = true;
    }
  }

  if (!authorized) {
    throw new Error('You are not authorized to export this project.');
  }

  const schema = await resolveSchema(project);
  const models = schema.models || [];
  const ui = schema.dashboardConfig || generateDashboardConfig(schema);

  const payload = {
    export_version: '1.0',
    exported_at: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug
    },
    models,
    ui
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}-adminforge.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return payload;
}

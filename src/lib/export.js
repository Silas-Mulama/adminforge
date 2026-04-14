import { supabase } from './supabase';
import { parseSchema, generateDashboardConfig } from './schema-engine';

const TYPE_MAP = {
  charfield: 'string',
  textfield: 'string',
  string: 'string',
  integerfield: 'integer',
  int: 'integer',
  bigint: 'integer',
  booleanfield: 'boolean',
  bool: 'boolean',
  datetimefield: 'datetime',
  datefield: 'datetime',
  timefield: 'datetime',
  foreignkey: 'foreign_key',
  manytomanyfield: 'many_to_many',
  filefield: 'file',
};

const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'secret',
  'token',
  'api_key',
  'api-token',
  'auth',
  'credential'
];

function normalizeType(type) {
  if (!type) return 'string';
  const key = String(type).trim().toLowerCase();
  return TYPE_MAP[key] ?? key;
}

function formatLabel(name) {
  if (!name) return '';
  return String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isSensitiveField(name) {
  if (!name) return false;
  const lower = String(name).toLowerCase();
  return SENSITIVE_FIELDS.some((s) => lower === s || lower.includes(`${s}_`) || lower.includes(`_${s}`));
}

function buildRelationships(model) {
  const relationships = model.relationships || {};
  const foreignKeys = Array.isArray(relationships.foreign_keys)
    ? relationships.foreign_keys.map((field) => {
        if (typeof field === 'object' && field.field) {
          return field;
        }
        const fieldName = String(field);
        const targetField = model.fields?.find((f) => f.name === fieldName)?.related_model;
        const target = targetField || (fieldName.endsWith('_id') ? fieldName.slice(0, -3) : null);
        return {
          field: fieldName,
          target,
        };
      })
    : [];

  const manyToMany = Array.isArray(relationships.many_to_many)
    ? relationships.many_to_many.map((entry) => {
        if (typeof entry === 'object' && entry.field) {
          return entry;
        }
        const fieldName = String(entry);
        const targetField = model.fields?.find((f) => f.name === fieldName)?.related_model;
        const target = targetField || null;
        return {
          field: fieldName,
          target,
        };
      })
    : [];

  return {
    foreign_keys: foreignKeys,
    many_to_many: manyToMany,
  };
}

function buildModels(models = []) {
  return models.map((model) => ({
    name: model.name,
    fields: Array.isArray(model.fields)
      ? model.fields.map((field) => ({
          name: field.name,
          type: normalizeType(field.type),
          required: Boolean(field.required),
          related_model: field.related_model || null,
        }))
      : [],
    relationships: buildRelationships(model),
  }));
}

function buildUiConfig(rawUiConfig, models = []) {
  const uiModels = rawUiConfig?.models ?? rawUiConfig;
  if (!uiModels || typeof uiModels !== 'object') {
    return {};
  }

  const fieldHiddenMap = models.reduce((acc, model) => {
    if (!Array.isArray(model.fields)) return acc;
    acc[model.name] = model.fields.reduce((fieldAcc, field) => {
      fieldAcc[field.name] = isSensitiveField(field.name);
      return fieldAcc;
    }, {});
    return acc;
  }, {});

  return Object.entries(uiModels).reduce((acc, [modelName, config]) => {
    const modelFieldsHidden = fieldHiddenMap[modelName] || {};

    const tableColumns = Array.isArray(config.table_config?.columns)
      ? config.table_config.columns
          .filter((col) => !modelFieldsHidden[col.name])
          .map((col) => ({
            name: col.name,
            label: formatLabel(col.name),
          }))
      : [];

    const formFields = Array.isArray(config.form_config?.fields)
      ? config.form_config.fields
          .filter((field) => !modelFieldsHidden[field.name])
          .map((field) => ({
            name: field.name,
            label: field.label ? formatLabel(field.label) : formatLabel(field.name),
          }))
      : [];

    const filterConfig = Object.entries(config.filter_config || {})
      .filter(([key]) => !modelFieldsHidden[key])
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    acc[modelName] = {
      table_config: { columns: tableColumns },
      form_config: { fields: formFields },
      filter_config: filterConfig,
    };

    return acc;
  }, {});
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeProject(project) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug || slugify(project.name),
  };
}

function normalizeSchemaDefinition(schema) {
  const normalized = buildModels(Array.isArray(schema.models) ? schema.models : []);
  const uiSource = schema.dashboardConfig || generateDashboardConfig(schema);
  const ui = buildUiConfig(uiSource, normalized);
  return { models: normalized, ui };
}

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
  const normalized = normalizeSchemaDefinition(schema);

  const payload = {
    export_version: '1.0',
    exported_at: new Date().toISOString(),
    project: normalizeProject(project),
    models: normalized.models,
    ui: normalized.ui,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(projectName || project.name).replace(/\s+/g, '-').toLowerCase()}-adminforge.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return payload;
}

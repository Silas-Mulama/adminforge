import { supabase } from './supabase';

export type UIColumnConfig = {
  name: string;
  label?: string;
  hidden?: boolean;
  order?: number;
};

export type UIModelConfig = {
  columns: UIColumnConfig[];
};

export type UIConfig = Record<string, UIModelConfig>;

export async function loadUIConfig(projectId: string): Promise<UIConfig> {
  const { data, error } = await supabase
    .from('projects')
    .select('ui_config')
    .eq('id', projectId)
    .single();

  if (error) {
    throw new Error(`Failed to load UI config: ${error.message || JSON.stringify(error)}`);
  }

  return data?.ui_config ?? {};
}

export async function saveUIConfig(projectId: string, uiConfig: UIConfig): Promise<UIConfig> {
  const { data, error } = await supabase
    .from('projects')
    .update({ ui_config: uiConfig })
    .eq('id', projectId)
    .select('ui_config')
    .single();

  if (error) {
    throw new Error(`Failed to save UI config: ${error.message || JSON.stringify(error)}`);
  }

  return data?.ui_config ?? uiConfig;
}

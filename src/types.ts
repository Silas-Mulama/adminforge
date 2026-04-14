export interface FieldConfig {
  name: string;
  type: 'CharField' | 'IntegerField' | 'BooleanField' | 'DateTimeField' | 'ForeignKey' | 'ManyToManyField' | 'FileField';
  required: boolean;
  related_model?: string;
}

export interface ModelConfig {
  name: string;
  fields: FieldConfig[];
  relationships: {
    foreign_keys: string[];
    many_to_many: string[];
  };
}

export interface SchemaConfig {
  models: ModelConfig[];
  ui_config?: UIConfig;
}

export interface UIColumnConfig {
  name: string;
  label?: string;
  hidden?: boolean;
  order?: number;
}

export interface UIModelConfig {
  columns: UIColumnConfig[];
}

export interface UIConfig {
  [modelName: string]: UIModelConfig;
}

export interface DashboardConfig {
  models: {
    [modelName: string]: {
      table_config: {
        columns: { name: string; type: string; sortable: boolean; filterable: boolean }[];
      };
      form_config: {
        fields: { name: string; type: string; label: string }[];
      };
      filter_config: {
        [fieldName: string]: { type: 'search' | 'range' | 'dropdown' | 'toggle' | 'date-range' };
      };
    };
  };
}

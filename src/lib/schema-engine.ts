import { SchemaConfig } from '@/src/types';

export async function parseSchema(input: string, type: 'sql' | 'django' | 'json'): Promise<SchemaConfig> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }

  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Parse the following ${type} input and return a normalized SchemaConfig JSON.
    Input:
    ${input}
    
    The output MUST be a JSON object with a "models" array.
    Each model has "name", "fields" (array of {name, type, required, related_model}), and "relationships" ({foreign_keys, many_to_many}).
    
    Field types should be one of: CharField, IntegerField, BooleanField, DateTimeField, ForeignKey, ManyToManyField, FileField.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            models: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  fields: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING },
                        required: { type: Type.BOOLEAN },
                        related_model: { type: Type.STRING }
                      },
                      required: ["name", "type", "required"]
                    }
                  },
                  relationships: {
                    type: Type.OBJECT,
                    properties: {
                      foreign_keys: { type: Type.ARRAY, items: { type: Type.STRING } },
                      many_to_many: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                  }
                },
                required: ["name", "fields", "relationships"]
              }
            }
          },
          required: ["models"]
        }
      }
    });

    if (!response.text) {
      throw new Error('Empty response from AI model');
    }

    return JSON.parse(response.text) as SchemaConfig;
  } catch (error: any) {
    console.error('AI Parse Error:', error);
    throw new Error(`AI Schema Parsing failed: ${error.message || 'Unknown error'}`);
  }
}

export function generateDashboardConfig(schema: SchemaConfig) {
  const config: any = { models: {} };
  
  schema.models.forEach(model => {
    config.models[model.name] = {
      table_config: {
        columns: model.fields.map(f => ({
          name: f.name,
          type: f.type,
          sortable: true,
          filterable: true
        }))
      },
      form_config: {
        fields: model.fields.map(f => ({
          name: f.name,
          type: f.type,
          label: f.name.charAt(0).toUpperCase() + f.name.slice(1)
        }))
      },
      filter_config: model.fields.reduce((acc: any, f) => {
        if (f.type === 'CharField') acc[f.name] = { type: 'search' };
        else if (f.type === 'IntegerField') acc[f.name] = { type: 'range' };
        else if (f.type === 'ForeignKey') acc[f.name] = { type: 'dropdown' };
        else if (f.type === 'BooleanField') acc[f.name] = { type: 'toggle' };
        else if (f.type === 'DateTimeField') acc[f.name] = { type: 'date-range' };
        return acc;
      }, {})
    };
  });
  
  return config;
}

import { SchemaConfig } from '@/src/types';

export async function parseSchema(input: string, type: 'sql' | 'django' | 'json'): Promise<SchemaConfig> {
  if (type === 'json') {
    try {
      const parsed = JSON.parse(input) as SchemaConfig;
      if (validateSchemaConfig(parsed)) {
        return parsed;
      }
    } catch (err) {
      // fallback to AI parsing if raw JSON is not normalized
    }
  }

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

export function validateSchemaConfig(schema: any): schema is SchemaConfig {
  return (
    schema &&
    Array.isArray(schema.models) &&
    schema.models.every((model: any) =>
      model &&
      typeof model.name === 'string' &&
      Array.isArray(model.fields) &&
      model.fields.every((field: any) =>
        typeof field.name === 'string' &&
        typeof field.type === 'string' &&
        typeof field.required === 'boolean'
      )
    )
  );
}

export async function generateSchemaFromDescription(description: string, style: 'sql' | 'django' | 'json'): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }

  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  let prompt = '';

  if (style === 'sql') {
    prompt = `
      Generate SQL CREATE TABLE statements for the following user request.
      User request:
      ${description}

      Output only valid SQL statements using standard PostgreSQL syntax. Do not include markdown or explanation.
    `;
  } else if (style === 'django') {
    prompt = `
      Generate Django model class definitions for the following user request.
      User request:
      ${description}

      Output only valid Python/Django model code. Do not include markdown or explanation.
    `;
  } else {
    prompt = `
      Generate a normalized SchemaConfig JSON object for the following user request.
      User request:
      ${description}

      Output only JSON with a "models" array. Each model should include "name", "fields" (array of {name, type, required, related_model}), and "relationships" ({foreign_keys, many_to_many}).
      Field types should be one of: CharField, IntegerField, BooleanField, DateTimeField, ForeignKey, ManyToManyField, FileField.
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "text/plain"
      }
    });

    if (!response.text) {
      throw new Error('Empty response from AI model');
    }

    return response.text.trim();
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    throw new Error(`AI schema generation failed: ${error.message || 'Unknown error'}`);
  }
}

export async function reviewSchemaWithAi(input: string, style: 'sql' | 'django' | 'json'): Promise<{ review: string; reason: string }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }

  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  let prompt = '';

  if (style === 'sql') {
    prompt = `
      Review and improve the following SQL schema.
      Preserve the existing table and column intent, fix syntax issues, and output a JSON object with keys \"review\" and \"reason\".
      The review key should contain valid PostgreSQL CREATE TABLE statements.
      The reason key should explain why the changes were suggested, highlight future features to consider, and note any areas to improve.
      Do not include markdown formatting.

      Input SQL:
      ${input}
    `;
  } else if (style === 'django') {
    prompt = `
      Review and improve the following Django model definitions.
      Preserve the existing model and field intent, fix syntax issues, and output a JSON object with keys \"review\" and \"reason\".
      The review key should contain valid Python/Django model code.
      The reason key should explain why the changes were suggested, highlight future features to consider, and note any areas to improve.
      Do not include markdown formatting.

      Input Django models:
      ${input}
    `;
  } else {
    prompt = `
      Review and improve the following JSON schema.
      Preserve the structure and semantics, fix any formatting or field issues, and output a JSON object with keys \"review\" and \"reason\".
      The review key should contain valid JSON.
      The reason key should explain why the changes were suggested, highlight future features to consider, and note any areas to improve.
      Do not include markdown formatting.

      Input JSON schema:
      ${input}
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            review: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["review", "reason"]
        }
      }
    });

    if (!response.text) {
      throw new Error('Empty response from AI model');
    }

    return JSON.parse(response.text) as { review: string; reason: string };
  } catch (error: any) {
    console.error('AI Review Error:', error);
    throw new Error(`AI schema review failed: ${error.message || 'Unknown error'}`);
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

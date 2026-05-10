/// <reference path="./editor-shims.d.ts" />

type AzureTranslateResponse = Array<{
  translations?: Array<{
    text?: string;
    to?: string;
  }>;
}>;

export async function translateWithAzure(args: {
  text: string;
  targetLanguage: string;
}): Promise<string> {
  const apiKey = Deno.env.get("AZURE_TRANSLATOR_KEY")?.trim();
  if (!apiKey) {
    throw new Error("Missing AZURE_TRANSLATOR_KEY");
  }

  const region = Deno.env.get("AZURE_TRANSLATOR_REGION")?.trim();
  if (!region) {
    throw new Error("Missing AZURE_TRANSLATOR_REGION");
  }

  const endpoint =
    Deno.env.get("AZURE_TRANSLATOR_ENDPOINT")?.trim() ||
    "https://api.cognitive.microsofttranslator.com";

  const sourceText = args.text.trim();
  if (!sourceText) {
    throw new Error("Missing source text");
  }

  const url = new URL("/translate", endpoint);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.append("to", args.targetLanguage);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Ocp-Apim-Subscription-Region": region,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: sourceText }]),
  });

  const rawText = await response.text();
  let parsedBody: AzureTranslateResponse | string = rawText;
  try {
    parsedBody = JSON.parse(rawText) as AzureTranslateResponse;
  } catch {
    parsedBody = rawText;
  }

  if (!response.ok) {
    const body =
      typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody);
    throw new Error(
      `Azure Translator request failed with HTTP ${response.status}: ${body}`,
    );
  }

  const translatedText =
    typeof parsedBody === "string"
      ? parsedBody.trim()
      : parsedBody[0]?.translations?.[0]?.text?.trim() ?? "";

  if (!translatedText) {
    throw new Error("Failed to translate text");
  }

  return translatedText;
}

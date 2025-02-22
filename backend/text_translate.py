from openai import OpenAI

from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    organization="org-wTKqrfyGm4y0SrDgy5jzh9SH",
    project="proj_TKDNPdEkva9jDdK19AGEN8w8",
)

completion = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "", "response_format": {"type": "json_object"}}
    ],
)


def translation_prompt(original_text: str, target_language: str):
    return f"Translate the following text from English to {target_language}: {original_text}"


def translate_text(original_text: str, target_language: str = "Spanish") -> str:
    prompt = translation_prompt(original_text, target_language)
    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
        )
        return completion.choices[0].message.content
    except Exception as e:
        raise Exception(f"Translation failed: {str(e)}")


if __name__ == "__main__":
    print(translate_text("Hello, how are you?", "Spanish"))

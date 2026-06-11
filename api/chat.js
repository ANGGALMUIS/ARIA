import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { pesan } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content:
            "Nama kamu Aria, asisten virtual hologram AI yang natural, santai, ramah, dan futuristik.",
        },
        {
          role: "user",
          content: pesan,
        },
      ],

      temperature: 0.8,
      max_tokens: 120,
    });

    res.status(200).json({
      jawaban: response.choices[0].message.content,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Server error",
    });
  }
}

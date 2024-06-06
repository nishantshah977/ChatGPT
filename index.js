import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import tiktoken from "tiktoken-node";
import axios from "axios";
import CloudflareToken from "./turnstile.js";
import dotenv from "dotenv";
dotenv.config();

let turnstile_token = null;

async function getResponse(messages, model) {
  console.log(turnstile_token);
  const raw_data = `{"prompt":"${JsonToPrompt(
    messages
  )}","model":"meta/${model}","temperature":0.75,"topP":0.9,"maxTokens":800,"image":null,"audio":null,"token":"${
    turnstile_token.token
  }"}`;
  const response = await axios.post("https://llama2.ai/api/", raw_data);
  if (response.status == 200) {
    return response.data; // Changed from response.text to response.data
  } else {
    return getResponse(); // Added return statement to ensure recursive call works correctly
  }
}

function JsonToPrompt(messages) {
  let formattedString = "";

  messages.forEach((message) => {
    formattedString += `<|begin_of_text|><|start_header_id|>${message.role}<|end_header_id|>\\n${message.content}<|eot_id|>\\n`;
  });
  return formattedString;
}
const app = express();
app.use(cors());
app.use(bodyParser.json());

function numTokensFromString(str, encodingName = "gpt2") {
  const encoding = tiktoken.getEncoding(encodingName);
  const numTokens = encoding.encode(str).length;
  return numTokens;
}

function generateCompletionId(prefix = "cmpl-") {
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const length = 28;
  let completionId = prefix;
  for (let i = 0; i < length; i++) {
    completionId += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return completionId;
}

app.get("/", (req, res) => {
  res.redirect("https://github.com/nishantshah977/ChatGPT");
});

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { messages, model } = req.body;
    const model_response = await getResponse(messages, model);

    // Calculate token usage (dummy values)
    const promptTokens = messages.reduce(
      (acc, msg) => acc + numTokensFromString(msg.content),
      0
    );

    const completionTokens = numTokensFromString(model_response);
    const totalTokens = promptTokens + completionTokens;

    const responseToClient = {
      choices: [
        {
          finish_reason: "stop",
          index: 0,
          message: {
            content: model_response,
            role: "assistant",
          },
          logprobs: null,
        },
      ],
      created: Math.floor(Date.now() / 1000),
      id: generateCompletionId(),
      model: model,
      object: "chat.completion",
      usage: {
        completion_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
      },
    };

    res.status(200).json(responseToClient);
  } catch (error) {
    console.log("🐛: https://github.com/nishantshah977/ChatGPT/issues");
    res.status(500).json({
      message: "Internal Server Error",
      error: error.toString(),
    });
    console.error(error);
  }
});

const port = process.env.PORT;
app.listen(port, async () => {
  console.log(`ℹ️: Server is running on port ${port}`);
  console.log(`⚠️: Base URL: http://localhost:${port}/v1/`);

  console.log("Starting Turnstile Bypass...");
  turnstile_token = await CloudflareToken(
    process.env.API_KEY,
    process.env.Process_ID
  );
  console.log("You're ready to rock");
});

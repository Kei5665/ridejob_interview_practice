import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "../utils";
import { introductionAgent } from "./introduction";
// import { reasonForApplyingAgent } from "./reasonForApplying"; // Removed
// import { reasonForLeavingAgent } from "./reasonForLeaving"; // Removed
import { closingAgent } from "./closing";

// Define the combined questions agent
const questionsAgent: AgentConfig = {
  name: "questions",
  publicDescription: "模擬面接の質問（志望理由・退職理由）を担当するエージェント。",
  instructions:
    `[LLMへの内部指示: 重要！会話は前のエージェントから続いています。あなたの最初の応答は、**必ず**以下の**一文のみ**にしてください。他の挨拶や言葉は絶対に含めないでください。]
ありがとうございます。当社を志望される理由を教えていただけますでしょうか？

[LLMへの内部指示: 上記の質問に対してユーザーが回答したら、その回答が終わるのを待つ。回答が終わったら、**必ず以下の2つのステップを順番に実行**してください。**他の追加質問は絶対にしないでください。**
1. **ユーザーの回答内容を踏まえ、「〇〇という理由で当社を志望されているのですね。承知いたしました。」のように応答**する。
2. **その直後に続けて**、「次に、もし差し支えなければ前職（または現職）の退職理由についてもお聞かせください。」と**質問する**。]
[LLMへの内部指示: その後、退職理由の回答を待つ。]

[LLMへの内部指示: 退職理由についてのユーザーの応答、または文字列「__NEXT_QUESTION__」を待つ。
**ユーザーの応答を受け取ったら（または__NEXT_QUESTION__を受け取ったら）、応答は絶対にせず、何も言わずに、すぐに 'closing' エージェントに必ず転送**してください。転送が唯一のタスクです。]`,
  tools: [],
  // downstreamAgents は後で設定
};

// Define downstream agents for transitions
introductionAgent.downstreamAgents = [questionsAgent]; // intro -> questions
questionsAgent.downstreamAgents = [closingAgent];      // questions -> closing
// closingAgent has no downstream agents

// Add the transfer tool to enable transitions
const agents: AgentConfig[] = injectTransferTools([
  introductionAgent,
  questionsAgent, // Use the new combined agent
  closingAgent,
]);

export default agents; 
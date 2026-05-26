export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  image?: string; // base64 encoded image data url
  isTyping?: boolean;
}

import api from './api';

export interface ChatMessage {
  text: string;
  sender: 'user' | 'titan';
}

export const chatService = {
  async sendMessage(message: string, conversationHistory: ChatMessage[]) {
    const response = await api.post('/chat/message', {
      message,
      conversationHistory
    });
    return response.data;
  }
};

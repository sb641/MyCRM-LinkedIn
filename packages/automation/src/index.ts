export interface ThreadSummary {
  id: string;
  title: string;
}

export interface MessagingProvider {
  listThreads(): Promise<ThreadSummary[]>;
}

export class MockMessagingProvider implements MessagingProvider {
  async listThreads(): Promise<ThreadSummary[]> {
    return [{ id: 'thread-1', title: 'Mock thread' }];
  }
}

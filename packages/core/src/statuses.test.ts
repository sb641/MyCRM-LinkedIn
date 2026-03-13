import {
  draftStatusSchema,
  jobStatusSchema,
  relationshipStatusSchema,
  sendStatusSchema,
  syncRunStatusSchema
} from './statuses';

describe('status schemas', () => {
  it('accepts valid statuses', () => {
    expect(relationshipStatusSchema.parse('new')).toBe('new');
    expect(draftStatusSchema.parse('approved')).toBe('approved');
    expect(sendStatusSchema.parse('queued')).toBe('queued');
    expect(jobStatusSchema.parse('running')).toBe('running');
    expect(syncRunStatusSchema.parse('failed')).toBe('failed');
  });

  it('rejects invalid statuses', () => {
    expect(() => relationshipStatusSchema.parse('wrong')).toThrow();
    expect(() => draftStatusSchema.parse('sent')).toThrow();
    expect(() => sendStatusSchema.parse('approved')).toThrow();
  });
});

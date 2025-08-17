const enrichCoreComment = require('./enrichCoreComment');
const {
  UserType,
  CommentType,
  CommentEvent,
  EventStatus,
} = require('../utils/enums');

describe('enrichCoreComment', () => {
  test('enriches requester comments', () => {
    const input = { TASK_TYPE: 'te_requester', DECISION: 'sub', foo: 'bar' };
    const result = enrichCoreComment(input);
    expect(result).toEqual({
      TASK_TYPE: 'TE_REQUESTER',
      DECISION: 'sub',
      foo: 'bar',
      USER_TYPE: UserType.TE_REQUESTER,
      COMMENT_TYPE: CommentType.DOCUMENT,
      COMMENT_EVENT: CommentEvent.SERVICE_REQUEST_CREATED,
      EVENT_STATUS_CD: EventStatus.IN_PROGRESS,
    });
    expect(input).toEqual({ TASK_TYPE: 'te_requester', DECISION: 'sub', foo: 'bar' });
  });

  test('handles resolution team approval', () => {
    const result = enrichCoreComment({ TASK_TYPE: 'TE_RESO_TEAM', DECISION: 'APR' });
    expect(result.USER_TYPE).toBe(UserType.RESOLUTION_TEAM);
    expect(result.COMMENT_TYPE).toBe(CommentType.MILESTONE);
    expect(result.COMMENT_EVENT).toBe(CommentEvent.SERVICE_REQUEST_RESOLVED);
    expect(result.EVENT_STATUS_CD).toBe(EventStatus.COMPLETED);
  });

  test('uses fallback when no rule matches', () => {
    const result = enrichCoreComment({});
    expect(result.USER_TYPE).toBe('No Task Type Provided');
    expect(result.COMMENT_TYPE).toBe(CommentType.DOCUMENT);
    expect(result.COMMENT_EVENT).toBe('Error Event');
    expect(result.EVENT_STATUS_CD).toBe('Error');
  });
});

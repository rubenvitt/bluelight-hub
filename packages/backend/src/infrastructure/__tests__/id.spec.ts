import { createId, isCuid } from '@paralleldrive/cuid2';

describe('test id generation', () => {
  test('test id', () => {
    const testId = createId();

    expect(isCuid(testId)).toBe(true);
    console.log(testId);
  });
});

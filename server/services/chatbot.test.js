/**
 * Unit tests for the chatbot keyword matcher. Run with:  npm test   (inside /server)
 */
const { normalize, matchIntent } = require('./chatbot');
const RULES = require('../config/chatbotRules');

describe('normalize', () => {
  test('ignores capital letters, accents and punctuation', () => {
    expect(normalize('  Emerhénsiya!!  ')).toBe('emerhensiya');
    expect(normalize('Mag-ulat, PAANO?')).toBe('mag ulat paano');
  });
});

describe('every menu option has keywords and is in the match order', () => {
  test.each(RULES.MENU)('%s', (option) => {
    expect(RULES.KEYWORDS[option].length).toBeGreaterThan(0);
    expect(RULES.MATCH_ORDER).toContain(option);
  });
});

describe('the keywords from the task, in English and Tagalog', () => {
  test.each([
    ['status', 'myStatus'],
    ['estado', 'myStatus'],
    ['report', 'howToReport'],
    ['ulat', 'howToReport'],
    ['baha', 'whatToReport'],
    ['flood', 'whatToReport'],
    ['basura', 'whatToReport'],
    ['garbage', 'whatToReport'],
    ['schedule', 'schedule'],
    ['oras', 'schedule'],
    ['emergency', 'emergency'],
    ['emerhensiya', 'emergency'],
    ['staff', 'talkToStaff'],
    ['tao', 'talkToStaff'],
  ])('"%s" -> %s', (text, option) => {
    expect(matchIntent(text)).toBe(option);
  });
});

describe('whole sentences', () => {
  test.each([
    ['What is the status of my report?', 'myStatus'],
    ['Ano ang estado ng ulat ko?', 'myStatus'],
    ['How do I submit a report?', 'howToReport'],
    ['Paano mag-ulat?', 'howToReport'],
    ['how to report flooding', 'howToReport'], // the phrase "how to" beats the word "flooding"
    ['What can I report?', 'whatToReport'],
    ['May baha sa amin', 'whatToReport'],
    ['Anong oras bukas ang chat?', 'schedule'],
    ['I want to talk to a person', 'talkToStaff'],
    ['Gusto kong makausap ang tao', 'talkToStaff'],
    ['EMERGENCY!!! may sunog', 'emergency'],
    ['report emergency flood', 'emergency'], // emergency always wins
  ])('"%s" -> %s', (text, option) => {
    expect(matchIntent(text)).toBe(option);
  });
});

describe('unknown messages', () => {
  test.each(['hello', 'salamat', '???', '', '   ', 'floods everywhere'])('"%s" -> null (show the menu again)', (text) => {
    expect(matchIntent(text)).toBeNull();
  });

  test('only whole words match ("reporter" is not "report")', () => {
    expect(matchIntent('reporter')).toBeNull();
  });
});

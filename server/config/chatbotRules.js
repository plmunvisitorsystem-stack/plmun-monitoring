/**
 * Rule-based chatbot (no AI). Edit the menu or the keywords here and restart
 * the server. The answers themselves are texts in client/src/i18n/en.json and
 * tl.json under "chatbot.answers" (the keys are the option ids below).
 *
 * MENU         - the buttons the bot shows, in this order.
 * MATCH_ORDER  - when a typed message matches several options, the first one
 *                in this list wins. Emergency is always checked first.
 * KEYWORDS     - English and Tagalog words or phrases for each option.
 *                Matching ignores capital letters, accents and punctuation,
 *                and only matches whole words ("flood" does not match "floods").
 *                Phrases (2+ words) are checked before single words, so
 *                "how to report flooding" -> howToReport, not whatToReport.
 */
module.exports = {
  MENU: ['howToReport', 'whatToReport', 'myStatus', 'schedule', 'emergency', 'talkToStaff'],

  MATCH_ORDER: ['emergency', 'talkToStaff', 'myStatus', 'schedule', 'howToReport', 'whatToReport'],

  KEYWORDS: {
    emergency: [
      'emergency', 'emergencies', 'emerhensiya', 'emerhensya', 'hotline', 'hotlines',
      'urgent', 'saklolo', 'sunog', 'fire', 'aksidente', 'accident', 'nalulunod', 'drowning',
    ],
    talkToStaff: [
      'staff', 'tao', 'person', 'human', 'agent', 'officer', 'kawani',
      'talk to', 'live chat', 'makausap', 'kausapin', 'kausap',
    ],
    myStatus: [
      'status', 'estado', 'track', 'progress', 'update', 'updates',
      'my report', 'my reports', 'aking ulat', 'ulat ko', 'mga ulat ko',
    ],
    schedule: [
      'schedule', 'iskedyul', 'oras', 'hours', 'office hours', 'chat hours', 'kailan bukas',
    ],
    howToReport: [
      'report', 'reports', 'ulat', 'submit', 'magpadala', 'ipadala', 'mag-ulat', 'magreport',
      'how to', 'how do i', 'paano',
    ],
    whatToReport: [
      'what can i report', 'what to report', 'ano ang puwedeng i-ulat', 'ano ang pwedeng i-ulat',
      'issue', 'issues', 'problema', 'uri',
      'baha', 'flood', 'flooding', 'basura', 'garbage', 'trash', 'waste',
      'polusyon', 'pollution', 'usok', 'smoke', 'hazard', 'panganib',
    ],
  },
};

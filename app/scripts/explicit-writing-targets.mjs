const TARGET_KO_BY_SAMPLE_ANSWER = new Map([
  ['My name is Mina.', '제 이름은 미나입니다.'],
  ['I like apples.', '저는 사과를 좋아합니다.'],
  ['I go to school every day.', '저는 매일 학교에 갑니다.'],
  ['I am happy today.', '저는 오늘 기분이 좋습니다.'],
  ['I am tired today.', '저는 오늘 피곤합니다.'],
  ['My name is Heewoung.', '제 이름은 희웅입니다.'],
  ['I like sushi.', '저는 초밥을 좋아합니다.'],
  ['Can I have a coffee, please?', '커피 한 잔 주세요.'],
  ['How are you?', '잘 지내?'],
  ['I am sorry.', '미안합니다.'],
  ['Where is the bus stop?', '버스 정류장이 어디에 있나요?'],
  ['Please speak slowly.', '천천히 말해 주세요.'],
  ['I am a student.', '저는 학생입니다.'],
  ['She likes pizza.', '그녀는 피자를 좋아합니다.'],
  ['I studied yesterday.', '저는 어제 공부했습니다.'],
  ['There is a cup on the desk.', '책상 위에 컵이 있습니다.'],
  ['Do you like music?', '음악을 좋아하나요?'],
  ['I do not drink water.', '저는 물을 마시지 않습니다.'],

  ['I am going to visit my friend this weekend.', '저는 이번 주말에 친구를 방문할 예정입니다.'],
  ['Could you help me with my homework?', '제 숙제를 도와줄 수 있나요?'],
  ['Would you like to have lunch with me?', '저와 점심을 함께 하시겠어요?'],
  ['I watched a movie yesterday.', '저는 어제 영화를 봤습니다.'],
  ['Would you like to see a movie this Saturday?', '이번 토요일에 영화 보러 갈래요?'],
  ['Can I get a coffee to go, please?', '커피 한 잔 포장해 주세요.'],
  [
    "I don't feel well, so I can't come to class today.",
    '몸이 좋지 않아서 오늘 수업에 갈 수 없습니다.',
  ],
  ['Could you take me to the airport, please?', '공항까지 데려다주시겠어요?'],
  ['Could you repeat your email address, please?', '이메일 주소를 다시 말해 주시겠어요?'],
  ['I am busy today, but I can meet you tomorrow.', '저는 오늘 바쁘지만 내일 만날 수 있습니다.'],
  ['Can I get a refund for this item?', '이 물건을 환불받을 수 있을까요?'],
  ['Sorry I am late.', '늦어서 미안합니다.'],
  ['I went to bed early because I was tired.', '피곤해서 일찍 잤습니다.'],
  ['My phone is newer than your phone.', '제 휴대폰은 당신의 휴대폰보다 더 새롭습니다.'],
  ['You should go to the doctor.', '당신은 의사에게 가야 합니다.'],
  ['I am studying English now.', '저는 지금 영어를 공부하고 있습니다.'],
  ['I am going to meet my friend tomorrow.', '저는 내일 친구를 만날 예정입니다.'],
  ['I have lost my wallet.', '저는 지갑을 잃어버렸습니다.'],

  [
    'I think online classes are convenient because I can study at home.',
    '집에서 공부할 수 있어서 온라인 수업이 편리하다고 생각합니다.',
  ],
  ['I visited Busan last summer and enjoyed the beach.', '지난여름 부산에 가서 해변을 즐겼습니다.'],
  ['You should take a short break if you feel tired.', '피곤하면 잠깐 쉬어야 합니다.'],
  ['This phone is more useful than my old one.', '이 휴대폰은 제 예전 휴대폰보다 더 유용합니다.'],
  ['What are you planning to do this weekend?', '이번 주말에 무엇을 할 계획인가요?'],
  ['Could you send me the report by tomorrow?', '내일까지 보고서를 보내 주시겠어요?'],
  ['Sorry for the late reply. I was busy with work.', '답장이 늦어서 죄송합니다. 일이 바빴습니다.'],
  [
    'I partly agree with you, but I think we need more time.',
    '당신의 의견에 부분적으로 동의하지만, 시간이 더 필요하다고 생각합니다.',
  ],
  ['Could I get a refund for this item?', '이 물건을 환불받을 수 있을까요?'],
  ['Could you explain that part again?', '그 부분을 다시 설명해 주시겠어요?'],
  ['Can you recommend a good restaurant near here?', '이 근처에 좋은 식당을 추천해 줄 수 있나요?'],
  ['Sorry to bother you, but can I ask a question?', '방해해서 죄송하지만 질문해도 될까요?'],
  ['I have already finished my homework.', '저는 이미 숙제를 끝냈습니다.'],
  ['I met a woman who works at the bank.', '저는 은행에서 일하는 여자를 만났습니다.'],
  ['This bread is made every morning.', '이 빵은 매일 아침 만들어집니다.'],
  ['If I have time, I will call you.', '시간이 있으면 전화할게요.'],
  ['The train is faster than the bus.', '기차는 버스보다 빠릅니다.'],
  ['Although it was expensive, I bought it.', '비쌌지만 저는 그것을 샀습니다.'],

  [
    'Flexible work can improve productivity if teams communicate clearly.',
    '팀이 명확하게 소통한다면 유연근무는 생산성을 높일 수 있습니다.',
  ],
  [
    'I understand your point, but I see the issue differently.',
    '당신의 요점은 이해하지만, 저는 그 문제를 다르게 봅니다.',
  ],
  ['Remote work saves time, but it can reduce teamwork.', '재택근무는 시간을 절약하지만 팀워크를 줄일 수 있습니다.'],
  [
    'I would appreciate it if you could review the document.',
    '문서를 검토해 주시면 감사하겠습니다.',
  ],
  [
    'I agree that studying abroad can broaden your perspective, but staying in your own country can also be valuable.',
    '유학이 시야를 넓힐 수 있다는 점에는 동의하지만, 자국에 머무는 것도 가치가 있을 수 있습니다.',
  ],
  [
    'I am writing to let you know that the product I received arrived damaged.',
    '제가 받은 상품이 파손된 상태로 도착했다는 점을 알려드리고자 합니다.',
  ],
  ['Could you clarify what you meant by the last point?', '마지막 요점이 무슨 뜻이었는지 설명해 주시겠어요?'],
  [
    'Maybe you should give yourself more time before making such a big decision.',
    '그런 큰 결정을 내리기 전에 시간을 더 가져보는 것이 좋을 것 같습니다.',
  ],
  [
    'Please note that our meeting has been moved from Monday morning to Tuesday afternoon.',
    '회의가 월요일 오전에서 화요일 오후로 변경되었음을 알려드립니다.',
  ],
  [
    'Although online reviews are subjective, they can still reveal common patterns.',
    '온라인 리뷰는 주관적이지만 공통된 패턴을 보여줄 수 있습니다.',
  ],
  [
    'I am concerned that this plan may take longer than expected.',
    '이 계획이 예상보다 더 오래 걸릴 수 있다는 점이 우려됩니다.',
  ],
  [
    'We apologize for the delay and will update you as soon as possible.',
    '지연에 대해 사과드리며 가능한 한 빨리 업데이트하겠습니다.',
  ],
  [
    'Realizing the mistake, she immediately contacted the client.',
    '그 실수를 깨닫고 그녀는 즉시 고객에게 연락했습니다.',
  ],
  [
    'All applications will be reviewed by the committee next month.',
    '모든 지원서는 다음 달 위원회가 검토할 예정입니다.',
  ],
  [
    'The manager said that they were considering a new schedule.',
    '관리자는 새 일정을 검토하고 있다고 말했습니다.',
  ],
  [
    'She explained it slowly so that everyone could understand.',
    '그녀는 모든 사람이 이해할 수 있도록 천천히 설명했습니다.',
  ],
  ['If I had known, I would have told you.', '알았더라면 너에게 말했을 텐데.'],
  [
    'Not only did she finish the report, but she also presented it clearly.',
    '그녀는 보고서를 끝냈을 뿐만 아니라 발표도 명확하게 했습니다.',
  ],
]);

const EXPLICIT_ENGLISH_WRITING_PROMPT_PATTERN = /^다음 문장을 영어로 쓰세요: [^"\r\n]+$/u;

export function createExplicitEnglishWritingPrompt(sampleAnswer, fallbackPromptKo = '') {
  const targetKo = TARGET_KO_BY_SAMPLE_ANSWER.get(sampleAnswer);

  if (!targetKo) {
    throw new Error(
      `Missing explicit Korean target for English writing sample "${sampleAnswer}" from "${fallbackPromptKo}"`,
    );
  }

  return `다음 문장을 영어로 쓰세요: ${targetKo}`;
}

export function normalizeEnglishWritingQuestionPrompt(question) {
  if (question?.kind !== 'writing' || question.answerLanguage === 'ko') {
    return question;
  }

  if (EXPLICIT_ENGLISH_WRITING_PROMPT_PATTERN.test(question.promptKo)) {
    return question;
  }

  return {
    ...question,
    promptKo: createExplicitEnglishWritingPrompt(question.sampleAnswer, question.promptKo),
  };
}

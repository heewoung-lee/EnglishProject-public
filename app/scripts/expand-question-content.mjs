import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEnglishWritingQuestionPrompt } from './explicit-writing-targets.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const repoRoot = resolve(appRoot, '..');
const dataRoot = join(appRoot, 'src', 'data');
const publicRoot = join(repoRoot, 'public', 'question-packs');
const packsRoot = join(publicRoot, 'packs');

const SCHEMA_VERSION = 1;
const PACK_VERSION = 7;
const PUBLISHED_AT = '2026-06-21T00:00:00.000Z';
const TARGET_PER_LEVEL = 160;
const EXTRA_PER_LEVEL = 56;
const LEVELS = ['A1', 'A2', 'B1', 'B2'];

function pad(index) {
  return String(index + 1).padStart(3, '0');
}

function withChoices(correct, wrongOne, wrongTwo) {
  return [
    { id: 'a', text: correct },
    { id: 'b', text: wrongOne },
    { id: 'c', text: wrongTwo },
  ];
}

function readingChoice(level, index, item) {
  return {
    id: `${level.toLowerCase()}-extra-reading-choice-${pad(index)}`,
    level,
    area: 'reading',
    kind: 'choice',
    promptKo: item.promptKo ?? '영어 문장을 읽고 의미가 맞는 것을 고르세요.',
    questionText: item.source,
    choices: withChoices(item.correct, item.wrongOne, item.wrongTwo),
    correctChoiceId: 'a',
    explanationKo: item.explanationKo,
    weakPointLabel: item.weakPointLabel,
  };
}

function readingTranslation(level, index, item, offset) {
  const difficulty = ['easy', 'medium', 'hard'][index % 3];
  const timeByLevel = {
    A1: [30, 45, 60],
    A2: [45, 60, 75],
    B1: [60, 75, 90],
    B2: [75, 90, 90],
  };

  return {
    id: `${level.toLowerCase()}-extra-reading-translation-${pad(index)}`,
    level,
    area: 'reading',
    kind: 'writing',
    promptKo: '영어 지문을 읽고 한글로 번역하세요.',
    questionText: item.source,
    sampleAnswer: item.sampleAnswer,
    evaluationFocusKo: item.evaluationFocusKo,
    expectedKeywords: item.expectedKeywords,
    answerLanguage: 'ko',
    expectedKeywordsKo: item.expectedKeywordsKo,
    readingDifficulty: difficulty,
    timeLimitSeconds: timeByLevel[level][index % 3],
    explanationKo: item.explanationKo,
    weakPointLabel: item.weakPointLabel,
  };
}

function conversationChoice(level, index, item) {
  return {
    id: `${level.toLowerCase()}-extra-conversation-choice-${pad(index)}`,
    level,
    area: 'conversation',
    kind: 'choice',
    promptKo: item.promptKo,
    questionText: item.questionText,
    choices: withChoices(item.correct, item.wrongOne, item.wrongTwo),
    correctChoiceId: 'a',
    explanationKo: item.explanationKo,
    weakPointLabel: item.weakPointLabel,
  };
}

function conversationWriting(level, index, item) {
  return {
    id: `${level.toLowerCase()}-extra-conversation-writing-${pad(index)}`,
    level,
    area: 'conversation',
    kind: 'writing',
    promptKo: item.promptKo,
    questionText: item.questionText,
    sampleAnswer: item.sampleAnswer,
    evaluationFocusKo: item.evaluationFocusKo,
    expectedKeywords: item.expectedKeywords,
    explanationKo: item.explanationKo,
    weakPointLabel: item.weakPointLabel,
  };
}

function grammarChoice(level, index, item) {
  return {
    id: `${level.toLowerCase()}-extra-grammar-choice-${pad(index)}`,
    level,
    area: 'grammar',
    kind: 'choice',
    promptKo: item.promptKo,
    questionText: item.questionText,
    choices: withChoices(item.correct, item.wrongOne, item.wrongTwo),
    correctChoiceId: 'a',
    explanationKo: item.explanationKo,
    weakPointLabel: item.weakPointLabel,
  };
}

function grammarWriting(level, index, item) {
  return {
    id: `${level.toLowerCase()}-extra-grammar-writing-${pad(index)}`,
    level,
    area: 'grammar',
    kind: 'writing',
    promptKo: item.promptKo,
    questionText: item.questionText,
    sampleAnswer: item.sampleAnswer,
    evaluationFocusKo: item.evaluationFocusKo,
    expectedKeywords: item.expectedKeywords,
    explanationKo: item.explanationKo,
    weakPointLabel: item.weakPointLabel,
  };
}

const content = {
  A1: {
    readingChoice: [
      ['The shop opens at nine.', '가게는 9시에 문을 엽니다.', '가게는 9시에 문을 닫습니다.', '가게는 오늘 쉽니다.', 'opens at nine은 9시에 문을 연다는 뜻입니다.', '시간 정보 이해'],
      ['Mina has a small umbrella.', '미나는 작은 우산을 가지고 있습니다.', '미나는 큰 가방을 가지고 있습니다.', '미나는 우산을 잃어버렸습니다.', 'has는 가지고 있다는 뜻이고 small umbrella는 작은 우산입니다.', '소유 표현'],
      ['Please sit here.', '여기에 앉아 주세요.', '여기에서 뛰어 주세요.', '여기를 떠나 주세요.', 'sit here는 여기에 앉으라는 뜻입니다.', '기본 동작 표현'],
      ['I drink water every morning.', '나는 매일 아침 물을 마십니다.', '나는 매일 밤 물을 삽니다.', '나는 아침을 먹지 않습니다.', 'drink water는 물을 마신다는 뜻이고 every morning은 매일 아침입니다.', '일상 행동'],
      ['The book is on the desk.', '책은 책상 위에 있습니다.', '책은 책상 아래에 있습니다.', '책상은 책 안에 있습니다.', 'on the desk는 책상 위라는 뜻입니다.', '위치 전치사'],
      ['He likes music.', '그는 음악을 좋아합니다.', '그는 음악을 만듭니다.', '그는 조용합니다.', 'likes는 좋아한다는 뜻입니다.', '기본 동사'],
      ['This bus goes to Seoul.', '이 버스는 서울로 갑니다.', '이 버스는 서울에서 옵니다.', '이 버스는 멈추지 않습니다.', 'goes to는 어디로 간다는 뜻입니다.', '이동 표현'],
      ['My phone is new.', '내 휴대폰은 새것입니다.', '내 휴대폰은 오래되었습니다.', '내 휴대폰은 없습니다.', 'new는 새롭다는 뜻입니다.', '형용사 의미'],
      ['They are in the kitchen.', '그들은 부엌에 있습니다.', '그들은 공원에 있습니다.', '그들은 부엌을 청소합니다.', 'in the kitchen은 부엌 안에 있다는 뜻입니다.', '장소 표현'],
      ['I need a pencil.', '나는 연필이 필요합니다.', '나는 연필을 팔고 있습니다.', '나는 연필을 찾았습니다.', 'need는 필요하다는 뜻입니다.', '필요 표현'],
      ['The door is open.', '문이 열려 있습니다.', '문이 잠겨 있습니다.', '문이 빨간색입니다.', 'open은 열린 상태를 말합니다.', '상태 표현'],
      ['We eat lunch at twelve.', '우리는 12시에 점심을 먹습니다.', '우리는 12시에 집에 갑니다.', '우리는 점심을 먹지 않습니다.', 'eat lunch는 점심을 먹는다는 뜻입니다.', '시간과 식사'],
    ],
    readingTranslation: [
      ['I have two pens.', '나는 펜 두 자루를 가지고 있습니다.', 'have와 two pens의 의미를 정확히 옮겼는지 평가합니다.', ['가지고', '펜', '두'], 'have는 소유를 나타내는 기본 동사입니다.', '소유 문장 번역'],
      ['The cafe is near my school.', '그 카페는 우리 학교 근처에 있습니다.', 'near와 my school의 위치 관계를 자연스럽게 번역했는지 평가합니다.', ['카페', '학교', '근처'], 'near는 가까이에 있다는 뜻입니다.', '위치 번역'],
      ['She reads a book after dinner.', '그녀는 저녁 식사 후에 책을 읽습니다.', 'after dinner와 reads a book의 의미를 포함했는지 평가합니다.', ['저녁', '후', '책'], 'after는 시간상 뒤를 나타냅니다.', '시간 순서 번역'],
      ['This bag is not heavy.', '이 가방은 무겁지 않습니다.', '부정문 not heavy를 정확히 옮겼는지 평가합니다.', ['가방', '무겁지', '않'], 'not은 부정을 만듭니다.', '부정문 번역'],
      ['Please call me tomorrow.', '내일 나에게 전화해 주세요.', 'please, call, tomorrow의 뜻을 자연스럽게 번역했는지 평가합니다.', ['내일', '전화', '주세요'], 'Please는 정중한 요청을 만듭니다.', '요청문 번역'],
      ['There is a chair in the room.', '방 안에 의자가 하나 있습니다.', 'There is와 in the room의 의미를 옮겼는지 평가합니다.', ['방', '의자', '있'], 'There is는 존재를 나타냅니다.', '존재문 번역'],
      ['My brother plays soccer on Sunday.', '내 남동생은 일요일에 축구를 합니다.', '주어, 운동, 요일 정보를 포함했는지 평가합니다.', ['남동생', '일요일', '축구'], 'on Sunday는 일요일에라는 뜻입니다.', '요일 표현 번역'],
      ['The station is behind the hotel.', '역은 호텔 뒤에 있습니다.', 'behind의 위치 의미를 정확히 번역했는지 평가합니다.', ['역', '호텔', '뒤'], 'behind는 뒤쪽을 뜻합니다.', '위치 관계 번역'],
      ['I am tired today.', '나는 오늘 피곤합니다.', 'tired와 today를 자연스럽게 옮겼는지 평가합니다.', ['오늘', '피곤', '나'], 'tired는 피곤한 상태를 말합니다.', '상태 번역'],
      ['Do you want some tea?', '차를 좀 마시겠습니까?', 'Do you want와 some tea의 뜻을 질문 형태로 번역했는지 평가합니다.', ['차', '마시', '습니까'], 'Do you want는 원하는지 묻는 표현입니다.', '질문 번역'],
      ['The movie starts at six.', '영화는 6시에 시작합니다.', 'starts at six의 시간 정보를 정확히 옮겼는지 평가합니다.', ['영화', '6시', '시작'], 'start는 시작하다는 뜻입니다.', '일정 번역'],
      ['We are friends.', '우리는 친구입니다.', '주어와 보어 관계를 자연스럽게 번역했는지 평가합니다.', ['우리', '친구', '입니다'], 'be동사는 주어의 상태나 정체를 나타냅니다.', 'be동사 번역'],
    ],
    conversationChoice: [
      ['물을 정중하게 요청하는 표현을 고르세요.', 'You are at a restaurant.', 'Can I have some water, please?', 'Water give me.', 'I am water.', 'Can I have ... please?는 정중한 요청입니다.', '정중한 요청'],
      ['처음 만난 사람에게 이름을 말하는 표현을 고르세요.', 'You introduce yourself.', 'My name is Jina.', 'Name me Jina.', 'I am name.', 'My name is ...는 이름을 말하는 기본 표현입니다.', '자기소개'],
      ['상대에게 다시 말해 달라고 하는 표현을 고르세요.', 'You did not hear the sentence.', 'Could you say that again?', 'Again you say that?', 'I cannot sentence.', 'Could you say that again?은 다시 말해 달라는 정중한 표현입니다.', '되묻기'],
      ['감사를 표현하는 말을 고르세요.', 'Someone helps you.', 'Thank you for your help.', 'Help is me.', 'You help yesterday?', 'Thank you for ...는 감사 이유를 말할 때 씁니다.', '감사 표현'],
      ['가격을 묻는 표현을 고르세요.', 'You are shopping.', 'How much is this?', 'How many this?', 'This money how?', 'How much is this?는 가격을 묻는 기본 표현입니다.', '가격 질문'],
      ['화장실 위치를 묻는 표현을 고르세요.', 'You need the restroom.', 'Where is the restroom?', 'What is restroom?', 'Restroom where go?', 'Where is ...?는 위치를 묻는 질문입니다.', '위치 질문'],
      ['작별 인사를 고르세요.', 'You leave your friend.', 'See you tomorrow.', 'Nice to meet you yesterday.', 'I am goodbye you.', 'See you tomorrow는 내일 보자는 자연스러운 인사입니다.', '작별 인사'],
      ['도움이 필요한지 묻는 표현을 고르세요.', 'You want to help someone.', 'Do you need help?', 'Need you help me?', 'Help is need?', 'Do you need help?는 도움이 필요한지 묻는 자연스러운 문장입니다.', '도움 제안'],
    ],
    conversationWriting: [
      ['자기소개를 영어 한 문장으로 쓰세요.', undefined, 'My name is Heewoung.', 'My name is ... 구조를 사용했는지 평가합니다.', ['my name', 'is'], '자기소개는 My name is ... 또는 I am ...으로 시작할 수 있습니다.', '기본 자기소개'],
      ['초밥을 좋아한다고 영어 한 문장으로 쓰세요.', undefined, 'I like sushi.', 'I like + 음식 구조를 사용했는지 평가합니다.', ['i like'], '좋아하는 것은 I like ...로 간단히 말할 수 있습니다.', '선호 표현'],
      ['커피를 주문하는 문장을 영어로 쓰세요.', undefined, 'Can I have a coffee, please?', 'Can I have와 please를 사용했는지 평가합니다.', ['can i have', 'coffee', 'please'], '주문할 때는 Can I have ... please?가 자연스럽습니다.', '주문 표현'],
      ['오늘 기분을 영어로 말하세요.', undefined, 'I am tired today.', 'I am + 감정 형용사 구조를 사용했는지 평가합니다.', ['i am', 'today'], '기분은 I am happy, tired, fine처럼 말합니다.', '감정 표현'],
      ['친구에게 안부를 묻는 문장을 쓰세요.', undefined, 'How are you?', '안부를 묻는 기본 질문인지 평가합니다.', ['how', 'are', 'you'], 'How are you?는 안부를 묻는 가장 기본적인 표현입니다.', '안부 질문'],
      ['영어로 사과하는 문장을 쓰세요.', undefined, 'I am sorry.', 'I am sorry 구조를 사용했는지 평가합니다.', ['sorry'], '미안함은 I am sorry 또는 Sorry로 표현합니다.', '사과 표현'],
      ['버스 정류장을 찾는 질문을 쓰세요.', undefined, 'Where is the bus stop?', 'Where is와 bus stop을 사용했는지 평가합니다.', ['where', 'bus stop'], '장소를 찾을 때 Where is ...?를 씁니다.', '길 묻기'],
      ['상대에게 천천히 말해 달라고 쓰세요.', undefined, 'Please speak slowly.', 'Please와 slowly를 사용했는지 평가합니다.', ['please', 'slowly'], '천천히 말해 달라고 할 때 speak slowly를 씁니다.', '속도 요청'],
    ],
    grammarChoice: [
      ['she가 주어일 때 동사가 맞는 문장을 고르세요.', undefined, 'She likes apples.', 'She like apples.', 'She liking apples.', '3인칭 단수 주어 she에는 likes를 씁니다.', '3인칭 단수'],
      ['They와 함께 쓰는 be동사가 맞는 문장을 고르세요.', undefined, 'They are students.', 'They is students.', 'They am students.', 'They에는 are를 사용합니다.', 'be동사 일치'],
      ['관사가 맞는 문장을 고르세요.', undefined, 'I have an apple.', 'I have a apple.', 'I have apple an.', 'apple은 모음 소리로 시작하므로 an을 씁니다.', '관사 사용'],
      ['복수형이 맞는 문장을 고르세요.', undefined, 'I have two books.', 'I have two book.', 'I has two books.', 'two 뒤에는 복수명사 books가 옵니다.', '복수 명사'],
      ['부정문이 맞는 문장을 고르세요.', undefined, 'I do not like milk.', 'I not like milk.', 'I does not like milk.', 'I에는 do not을 사용합니다.', '일반동사 부정문'],
      ['의문문이 맞는 문장을 고르세요.', undefined, 'Do you like music?', 'You do like music?', 'Does you like music?', 'you를 주어로 하는 일반동사 의문문은 Do you ...?입니다.', '일반동사 의문문'],
      ['전치사가 맞는 문장을 고르세요.', undefined, 'The key is in the bag.', 'The key is at the bag.', 'The key is on the bag inside.', '가방 안은 in the bag입니다.', '장소 전치사'],
      ['현재진행형 문장을 고르세요.', undefined, 'I am reading now.', 'I reading now.', 'I am read now.', '현재진행형은 be동사 + 동사-ing입니다.', '현재진행형'],
      ['과거시제 문장을 고르세요.', undefined, 'I watched TV yesterday.', 'I watch TV yesterday.', 'I watching TV yesterday.', 'yesterday가 있으므로 과거형 watched가 필요합니다.', '과거시제'],
      ['소유격이 맞는 문장을 고르세요.', undefined, 'This is my bag.', 'This is me bag.', 'This is I bag.', '명사 앞에는 소유격 my를 씁니다.', '소유격'],
    ],
    grammarWriting: [
      ['나는 학생입니다를 영어로 쓰세요.', undefined, 'I am a student.', 'I am과 a student를 사용했는지 평가합니다.', ['i am', 'student'], '직업이나 신분을 말할 때 단수명사 앞에 a를 붙입니다.', 'be동사 문장'],
      ['그녀는 피자를 좋아합니다를 영어로 쓰세요.', undefined, 'She likes pizza.', '3인칭 단수 동사 likes를 사용했는지 평가합니다.', ['she', 'likes', 'pizza'], 'she/he/it 주어에는 동사에 s를 붙입니다.', '3인칭 단수 쓰기'],
      ['나는 어제 공부했습니다를 영어로 쓰세요.', undefined, 'I studied yesterday.', '과거형 studied와 yesterday를 사용했는지 평가합니다.', ['studied', 'yesterday'], '어제 한 일은 과거시제로 표현합니다.', '과거시제 쓰기'],
      ['책상 위에 컵이 있습니다를 영어로 쓰세요.', undefined, 'There is a cup on the desk.', 'There is와 on the desk를 사용했는지 평가합니다.', ['there is', 'cup', 'desk'], '존재를 말할 때 There is ...를 사용합니다.', '존재문 쓰기'],
      ['너는 음악을 좋아하니를 영어로 쓰세요.', undefined, 'Do you like music?', 'Do you와 like music 어순을 사용했는지 평가합니다.', ['do you', 'like', 'music'], '일반동사 의문문은 Do you + 동사원형입니다.', '의문문 쓰기'],
      ['나는 물을 마시지 않습니다를 영어로 쓰세요.', undefined, 'I do not drink water.', 'do not과 동사원형 drink를 사용했는지 평가합니다.', ['do not', 'drink', 'water'], '일반동사 부정문은 do not + 동사원형입니다.', '부정문 쓰기'],
    ],
  },
  A2: {
    readingChoice: [
      ['Bus 24 does not stop at City Hall on Sundays.', '24번 버스는 일요일에 시청에 서지 않습니다.', '24번 버스는 일요일에만 운행합니다.', '24번 버스는 매일 시청에 섭니다.', 'does not stop은 정차하지 않는다는 뜻입니다.', '안내문 세부 정보'],
      ['Can you bring my blue jacket to school? I left it at your house.', '파란 재킷을 학교에 가져와 달라는 부탁입니다.', '학교에 오지 말라는 안내입니다.', '재킷을 새로 사 달라는 요청입니다.', 'bring과 left it at your house를 보면 물건을 가져와 달라는 요청입니다.', '글의 목적'],
      ['It will rain this afternoon, so the soccer game will be in the gym.', '비 때문에 축구 경기는 체육관에서 열립니다.', '축구 경기는 이번 주에 취소됩니다.', '오후에는 날씨가 맑아집니다.', 'so 뒤에 결과가 나오며 in the gym이 장소입니다.', '원인과 결과'],
      ['The cafe opens at 8 a.m. and closes at 6 p.m. We are closed on Mondays.', '카페는 월요일에 영업하지 않습니다.', '카페는 월요일에만 영업합니다.', '카페는 오전 6시에 엽니다.', 'closed on Mondays는 월요일 휴무라는 뜻입니다.', '영업시간 이해'],
      ['The train to Daejeon leaves from platform 3 at 10:20.', '대전행 기차는 10시 20분에 3번 플랫폼에서 출발합니다.', '대전행 기차는 3시 20분에 도착합니다.', '서울행 기차는 10번 플랫폼에서 출발합니다.', 'leaves from platform 3와 at 10:20이 핵심 정보입니다.', '교통 안내 이해'],
      ['I will be ten minutes late because the subway is slow today.', '지하철이 느려서 10분 늦을 예정입니다.', '회의가 취소되어 집에 갑니다.', '오늘 지하철을 타지 않을 예정입니다.', 'because 뒤에 지연 이유가 나옵니다.', '이유 파악'],
      ['No photos in the museum, please.', '박물관에서는 사진을 찍으면 안 됩니다.', '박물관 사진을 사야 합니다.', '박물관에서 많은 사진을 찍어도 됩니다.', 'No photos는 사진 촬영 금지를 의미합니다.', '표지판 이해'],
      ['First, wash the apples. Then cut them and put them in a bowl.', '먼저 사과를 씻고 그다음 자릅니다.', '사과를 자른 뒤에 씻습니다.', '그릇을 사과 안에 넣습니다.', 'First와 Then이 순서를 알려 줍니다.', '순서 이해'],
      ['A black wallet was found near the school gate. Please come to the office.', '학교 정문 근처에서 검은 지갑이 발견되었습니다.', '검은 가방을 교실에서 잃어버렸습니다.', '사무실이 학교 정문으로 이동했습니다.', 'was found는 발견되었다는 뜻입니다.', '분실물 안내'],
      ['We need a weekend helper at our bookstore. You must be friendly and enjoy reading.', '서점에서 주말에 일할 친절한 사람을 찾고 있습니다.', '병원에서 평일마다 일할 사람을 찾고 있습니다.', '책 읽기를 싫어하는 사람을 원합니다.', 'weekend helper at our bookstore가 핵심입니다.', '구인 광고 이해'],
      ['Please return books within two weeks. Do not eat in the reading room.', '책은 2주 안에 반납하고 열람실에서 먹으면 안 됩니다.', '책은 두 달 동안 빌릴 수 있습니다.', '열람실에서 식사할 수 있습니다.', 'within two weeks는 2주 안에라는 뜻입니다.', '규칙 이해'],
      ['To make this soup, you need carrots, potatoes, and chicken.', '이 수프에는 당근, 감자, 닭고기가 필요합니다.', '이 수프에는 쌀, 우유, 양파가 필요합니다.', '이 수프는 빵과 치즈로 만듭니다.', 'need 뒤에 필요한 재료가 나열됩니다.', '재료 정보 찾기'],
    ],
    readingTranslation: [
      ['The store was crowded, so we waited outside for ten minutes.', '가게가 붐벼서 우리는 밖에서 10분 동안 기다렸습니다.', 'crowded, waited outside, ten minutes의 의미를 정확히 옮겼는지 평가합니다.', ['붐벼', '밖', '10분'], 'so는 앞 문장의 결과를 연결합니다.', '결과 연결 번역'],
      ['The shop is closed today, so I will come back tomorrow.', '가게가 오늘 문을 닫아서 나는 내일 다시 올 것입니다.', 'closed today와 come back tomorrow를 포함했는지 평가합니다.', ['오늘', '닫', '내일'], 'will come back은 다시 올 것이라는 미래 행동입니다.', '미래 표현 번역'],
      ['I bought this shirt because it was cheaper than the other one.', '나는 이 셔츠가 다른 것보다 더 싸서 샀습니다.', 'because와 cheaper than의 의미를 자연스럽게 번역했는지 평가합니다.', ['셔츠', '더 싸', '샀'], 'cheaper than은 더 싸다는 비교 표현입니다.', '비교 번역'],
      ['Could you speak more slowly? I could not understand the address.', '좀 더 천천히 말씀해 주시겠어요? 주소를 이해하지 못했습니다.', '정중한 요청과 이해하지 못한 내용을 포함했는지 평가합니다.', ['천천히', '주소', '이해'], 'Could you는 정중한 요청을 만들고 more slowly는 더 천천히입니다.', '요청문 번역'],
      ['We moved the meeting to Friday because many people were busy.', '많은 사람들이 바빠서 우리는 회의를 금요일로 옮겼습니다.', 'moved the meeting와 because절을 정확히 옮겼는지 평가합니다.', ['회의', '금요일', '바빠'], 'move a meeting은 회의 일정을 옮긴다는 뜻입니다.', '일정 변경 번역'],
      ['The museum is free for children under twelve.', '그 박물관은 12세 미만 어린이에게 무료입니다.', 'free, children, under twelve의 의미를 옮겼는지 평가합니다.', ['박물관', '무료', '12세'], 'under twelve는 12세 미만입니다.', '조건 정보 번역'],
      ['I forgot my password, so I cannot log in.', '비밀번호를 잊어버려서 로그인할 수 없습니다.', 'forgot password와 cannot log in을 포함했는지 평가합니다.', ['비밀번호', '잊', '로그인'], 'cannot은 할 수 없다는 뜻입니다.', '문제 상황 번역'],
      ['This jacket is too small. Do you have a larger size?', '이 재킷은 너무 작습니다. 더 큰 사이즈가 있나요?', 'too small과 larger size의 의미를 정확히 옮겼는지 평가합니다.', ['재킷', '작', '큰 사이즈'], 'larger는 더 큰이라는 비교급입니다.', '쇼핑 표현 번역'],
      ['The class starts in five minutes, so please be quiet.', '수업이 5분 후에 시작하니 조용히 해 주세요.', 'starts in five minutes와 please be quiet을 자연스럽게 번역했는지 평가합니다.', ['수업', '5분', '조용히'], 'in five minutes는 5분 후를 뜻합니다.', '시간 표현 번역'],
      ['I usually take a walk after dinner when the weather is nice.', '나는 날씨가 좋을 때 보통 저녁 식사 후 산책합니다.', 'usually, after dinner, weather is nice를 포함했는지 평가합니다.', ['보통', '저녁', '날씨'], 'usually는 보통이라는 빈도 표현입니다.', '빈도 표현 번역'],
      ['Please check your email before you leave the office.', '사무실을 떠나기 전에 이메일을 확인해 주세요.', 'before you leave와 check your email을 정확히 옮겼는지 평가합니다.', ['떠나기 전', '이메일', '확인'], 'before는 어떤 일보다 앞선 시간을 나타냅니다.', '시간 접속사 번역'],
      ['I am looking for a quiet place to study.', '나는 공부할 조용한 장소를 찾고 있습니다.', 'looking for와 quiet place to study를 포함했는지 평가합니다.', ['찾고', '조용한', '공부'], 'look for는 찾다라는 뜻입니다.', '목적 표현 번역'],
    ],
    conversationChoice: [
      ['상대방에게 천천히 말해 달라고 정중하게 요청하는 표현을 고르세요.', undefined, 'Could you speak more slowly, please?', 'Speak slow now.', 'You are too fast.', 'Could you ... please?는 정중한 요청입니다.', '정중한 요청'],
      ['식당에서 물을 요청하는 자연스러운 표현을 고르세요.', undefined, 'Can I have some water, please?', 'Give water.', 'Water is me.', 'Can I have ... please?는 식당에서 자연스럽게 요청할 때 씁니다.', '식당 요청'],
      ['약속을 취소해야 할 때 알맞은 표현을 고르세요.', undefined, 'I need to cancel our plan.', 'I cancel yesterday.', 'Our plan is eat.', 'need to cancel은 취소해야 한다는 뜻입니다.', '약속 취소'],
      ['가게에서 다른 색이 있는지 묻는 표현을 고르세요.', undefined, 'Do you have this in another color?', 'This color is another?', 'Give me color different.', 'Do you have this in another color?는 쇼핑 상황에서 자연스럽습니다.', '쇼핑 질문'],
      ['길을 물을 때 가장 자연스러운 표현을 고르세요.', undefined, 'How can I get to the station?', 'Where station?', 'Station go me?', 'How can I get to ...?는 목적지까지 가는 방법을 묻습니다.', '길 묻기'],
      ['전화 통화에서 잠시 기다려 달라고 말하는 표현을 고르세요.', undefined, 'Please hold on a moment.', 'Stop phone.', 'You wait long yesterday.', 'Please hold on a moment는 전화에서 잠시 기다려 달라는 표현입니다.', '전화 표현'],
      ['상대방의 의견에 동의하는 표현을 고르세요.', undefined, 'I agree with you.', 'I am agree you.', 'You agree me.', 'agree with someone 형태로 동의를 표현합니다.', '의견 동의'],
      ['호텔에서 체크인하고 싶다고 말하는 표현을 고르세요.', undefined, "I'd like to check in, please.", 'I want room now.', 'Check me in room.', "I'd like to ... please는 정중하게 원하는 일을 말할 때 씁니다.", '호텔 체크인'],
    ],
    conversationWriting: [
      ['친구에게 이번 토요일에 영화 보러 가자고 영어로 제안하세요.', undefined, 'Would you like to see a movie this Saturday?', 'Would you like to와 this Saturday를 사용했는지 평가합니다.', ['would you like', 'movie', 'saturday'], 'Would you like to ...?는 정중한 제안입니다.', '제안하기'],
      ['카페에서 커피 한 잔을 포장해 달라고 영어로 말하세요.', undefined, 'Can I get a coffee to go, please?', 'to go와 please를 사용했는지 평가합니다.', ['coffee', 'to go', 'please'], 'to go는 포장해 갈 때 쓰는 표현입니다.', '카페 주문'],
      ['몸이 좋지 않아 오늘 수업에 못 간다고 영어로 쓰세요.', undefined, "I don't feel well, so I can't come to class today.", "몸 상태와 불가능한 행동을 so와 can't로 연결했는지 평가합니다.", ["don't feel well", "can't", 'class'], "I don't feel well은 몸이 좋지 않다는 표현입니다.", '상태 설명'],
      ['택시 기사에게 공항까지 가 달라고 영어로 말하세요.', undefined, 'Could you take me to the airport, please?', 'Could you take me to와 목적지를 사용했는지 평가합니다.', ['take me', 'airport', 'please'], 'take me to는 어떤 장소로 데려다준다는 뜻입니다.', '교통 요청'],
      ['상대방에게 이메일 주소를 다시 말해 달라고 영어로 요청하세요.', undefined, 'Could you repeat your email address, please?', 'repeat와 email address를 사용했는지 평가합니다.', ['repeat', 'email address', 'please'], 'repeat는 다시 말하다라는 뜻입니다.', '정보 확인 요청'],
      ['친구에게 오늘은 바쁘지만 내일 만날 수 있다고 답하세요.', undefined, 'I am busy today, but I can meet you tomorrow.', 'but과 can을 사용해 상황과 가능한 시간을 말했는지 평가합니다.', ['busy', 'can', 'tomorrow'], 'but은 서로 다른 내용을 연결할 때 씁니다.', '일정 답장'],
      ['가게 직원에게 이 물건을 환불할 수 있는지 물어보세요.', undefined, 'Can I get a refund for this item?', 'refund와 this item을 사용했는지 평가합니다.', ['refund', 'item'], 'refund는 환불을 뜻합니다.', '환불 요청'],
      ['친구에게 늦어서 미안하다고 영어로 말하세요.', undefined, 'Sorry I am late.', 'Sorry와 late를 사용했는지 평가합니다.', ['sorry', 'late'], '늦었을 때는 Sorry I am late라고 말할 수 있습니다.', '사과 표현'],
    ],
    grammarChoice: [
      ['과거시제로 맞는 문장을 고르세요.', undefined, 'She went to the market yesterday.', 'She go to the market yesterday.', 'She goes to the market yesterday.', 'yesterday가 있으므로 go의 과거형 went를 씁니다.', '과거시제'],
      ['현재진행형으로 맞는 문장을 고르세요.', undefined, 'They are playing basketball now.', 'They playing basketball now.', 'They is playing basketball now.', 'They에는 are를 쓰고 동사는 -ing 형태가 됩니다.', '현재진행형'],
      ['비교급 문장으로 맞는 것을 고르세요.', undefined, 'This bag is heavier than that one.', 'This bag is heavy than that one.', 'This bag is more heavy that one.', 'heavy의 비교급은 heavier입니다.', '비교급'],
      ['some과 any 중 알맞은 문장을 고르세요.', undefined, 'Do you have any questions?', 'Do you have some questions?', 'Do you have a questions?', '일반적인 의문문에서는 any를 자주 사용합니다.', 'some과 any'],
      ['미래 계획을 나타내는 문장을 고르세요.', undefined, 'I am going to study tonight.', 'I going to study tonight.', 'I went to study tonight.', 'be going to는 미래 계획을 나타냅니다.', '미래 계획'],
      ['조언을 나타내는 문장을 고르세요.', undefined, 'You should drink some water.', 'You should drinking water.', 'You should to drink water.', 'should 뒤에는 동사원형을 씁니다.', 'should 사용'],
      ['전치사가 알맞은 문장을 고르세요.', undefined, 'The picture is on the wall.', 'The picture is in the wall.', 'The picture is at the wall.', '벽 표면에 붙은 것은 on the wall입니다.', '장소 전치사'],
      ['빈도부사의 위치가 맞는 문장을 고르세요.', undefined, 'I usually eat breakfast at seven.', 'I eat usually breakfast at seven.', 'Usually I breakfast eat at seven.', 'usually는 일반동사 앞에 오는 것이 자연스럽습니다.', '빈도부사 위치'],
      ['There is/are가 맞는 문장을 고르세요.', undefined, 'There are three chairs in the room.', 'There is three chairs in the room.', 'There have three chairs in the room.', 'three chairs는 복수이므로 There are를 씁니다.', '존재 구문'],
      ['He가 주어인 현재완료 문장으로 맞는 것을 고르세요.', undefined, 'He has lost his key.', 'He have lost his key.', 'He has lose his key.', 'he에는 has를 쓰고 현재완료는 has + 과거분사입니다.', '현재완료'],
    ],
    grammarWriting: [
      ['because를 사용해 쓰세요: 피곤해서 일찍 잤습니다.', undefined, 'I went to bed early because I was tired.', 'because와 과거시제를 사용했는지 평가합니다.', ['because', 'tired', 'went to bed'], 'because 뒤에는 이유가 옵니다.', '이유 연결'],
      ['비교급을 사용해 쓰세요: 내 휴대폰은 네 휴대폰보다 더 새롭습니다.', undefined, 'My phone is newer than your phone.', 'newer than 구조를 사용했는지 평가합니다.', ['newer', 'than', 'phone'], 'new의 비교급은 newer입니다.', '비교급 문장 작성'],
      ['should를 사용해 조언 문장을 쓰세요: 너는 의사에게 가야 합니다.', undefined, 'You should go to the doctor.', 'should 뒤에 동사원형 go를 사용했는지 평가합니다.', ['should', 'go', 'doctor'], 'should는 조언을 할 때 씁니다.', '조언 문장 작성'],
      ['현재진행형으로 쓰세요: 나는 지금 영어를 공부하고 있습니다.', undefined, 'I am studying English now.', 'am studying과 now를 사용했는지 평가합니다.', ['am studying', 'english', 'now'], '현재진행형은 be동사 + 동사-ing입니다.', '현재진행형 쓰기'],
      ['미래 계획을 쓰세요: 나는 내일 친구를 만날 예정입니다.', undefined, 'I am going to meet my friend tomorrow.', 'am going to와 tomorrow를 사용했는지 평가합니다.', ['going to', 'meet', 'tomorrow'], 'be going to는 계획된 미래를 나타냅니다.', '미래 계획 쓰기'],
      ['현재완료를 사용해 쓰세요: 나는 지갑을 잃어버렸습니다.', undefined, 'I have lost my wallet.', 'have lost와 wallet을 사용했는지 평가합니다.', ['have lost', 'wallet'], '현재완료는 현재와 관련된 과거 결과를 말할 수 있습니다.', '현재완료 쓰기'],
    ],
  },
  B1: {
    readingChoice: [
      ['Our office will close at 3 p.m. on Friday because the heating system needs repair.', '난방 수리 때문에 금요일 오후 3시에 사무실이 닫힙니다.', '점심 초대 때문에 사무실이 열립니다.', '금요일에 난방 시스템을 새로 판매합니다.', 'because 뒤에 사무실 조기 종료 이유가 나옵니다.', '공지 목적 파악'],
      ['The cafe is small. However, many students like it because it is quiet.', '카페는 작지만 조용해서 학생들이 좋아합니다.', '카페가 커서 학생들이 싫어합니다.', '카페는 시끄러워서 문을 닫았습니다.', 'However는 앞뒤의 대조를 나타냅니다.', '대조 연결어'],
      ['I was nervous before my first presentation, but my classmates listened carefully.', '처음 발표 전에는 긴장했지만 친구들이 잘 들어 주었습니다.', '발표 후 친구들이 모두 떠났습니다.', '처음 발표가 없어서 지루했습니다.', 'nervous와 but 뒤의 긍정적 반응을 함께 이해해야 합니다.', '감정 추론'],
      ['Mina decided to cut down on sugar after her doctor gave her advice.', '미나는 의사의 조언 후 설탕 섭취를 줄이기로 했습니다.', '미나는 설탕을 더 많이 사기로 했습니다.', '미나는 의사의 조언을 무시했습니다.', 'cut down on은 줄이다라는 뜻입니다.', '구동사 의미'],
      ['The city library now opens on Sundays from 10 a.m. to 4 p.m. until the end of August.', '도서관은 8월 말까지 일요일에 임시로 엽니다.', '도서관은 매주 일요일 영구적으로 닫힙니다.', '도서관은 오후 4시에 문을 엽니다.', 'until the end of August가 기간 제한을 나타냅니다.', '세부 정보 확인'],
      ['Many people ride bicycles to work because cycling is good exercise and saves money.', '자전거 출근은 운동이 되고 돈도 절약합니다.', '자전거 출근은 항상 더 비쌉니다.', '자전거는 출근에 사용할 수 없습니다.', 'good exercise와 saves money가 핵심 장점입니다.', '핵심 장점 파악'],
      ['Working in a group can be slower at first, but it often leads to better results.', '그룹 작업은 처음엔 느릴 수 있지만 더 나은 결과를 만들 수 있습니다.', '사람들은 항상 혼자 일해야 합니다.', '다른 생각은 프로젝트를 불가능하게 만듭니다.', 'but 뒤에 글쓴이의 균형 잡힌 중심 생각이 나옵니다.', '중심 생각'],
      ['Please bring your receipt if you want to exchange the shoes.', '신발을 교환하려면 영수증을 가져와야 합니다.', '신발을 빌리려면 친구를 초대해야 합니다.', '영수증을 버리면 할인이 됩니다.', 'exchange는 교환하다라는 뜻입니다.', '상황 어휘'],
      ['Tom missed the bus, so he called his manager and said he would be fifteen minutes late.', '톰은 버스를 놓쳐 관리자에게 15분 늦는다고 알렸습니다.', '톰은 평소보다 일찍 도착했습니다.', '톰은 관리자를 차로 태워 주었습니다.', 'missed the bus가 원인이고 would be late가 결과입니다.', '원인과 결과'],
      ['The new park has clean paths, bright lights, and a small garden for children.', '새 공원은 깨끗한 길과 밝은 조명, 어린이 정원이 있습니다.', '새 공원은 어둡고 위험합니다.', '새 공원에는 어린이가 갈 수 없습니다.', '긍정적인 특징들이 나열되어 있습니다.', '분위기 파악'],
      ['The hotel was more expensive than we expected. On the other hand, the service was excellent.', '호텔은 예상보다 비쌌지만 서비스는 훌륭했습니다.', '호텔은 싸고 서비스가 나빴습니다.', '호텔 서비스는 가격과 관련이 없습니다.', 'On the other hand는 대조되는 장단점을 연결합니다.', '대조 표현'],
      ['Sara joined a conversation club and plans to attend every Wednesday.', '사라는 매주 수요일 회화 동아리에 참석할 예정입니다.', '사라는 영어 공부를 그만두려 합니다.', '사라는 수요일마다 수학을 가르칩니다.', 'plans to attend every Wednesday가 반복 계획을 나타냅니다.', '내용 예측'],
    ],
    readingTranslation: [
      ['The school cafeteria will add two vegetarian dishes next month because many students asked for healthier choices.', '많은 학생들이 더 건강한 선택지를 요청했기 때문에 학교 식당은 다음 달 채식 메뉴 두 가지를 추가할 것입니다.', '변화, 시점, 이유를 모두 포함했는지 평가합니다.', ['식당', '채식', '건강한'], 'because는 이유를 연결하고 will add는 추가할 예정이라는 뜻입니다.', '공지문 번역'],
      ['After comparing prices online, Jisoo decided to buy the laptop from a local store.', '온라인에서 가격을 비교한 후 지수는 지역 매장에서 노트북을 사기로 결정했습니다.', 'After comparing과 decided to buy를 자연스럽게 번역했는지 평가합니다.', ['가격', '비교', '노트북'], 'decided to는 ~하기로 결정했다는 뜻입니다.', '결정 내용 번역'],
      ['The outdoor concert was moved to the gym because heavy rain was expected in the evening.', '저녁에 폭우가 예상되어 야외 콘서트가 체육관으로 옮겨졌습니다.', '수동태 was moved와 이유를 정확히 옮겼는지 평가합니다.', ['콘서트', '체육관', '폭우'], 'was moved는 옮겨졌다는 수동태입니다.', '수동태 번역'],
      ['In my view, students learn better when they can ask questions freely.', '내 생각에는 학생들이 자유롭게 질문할 수 있을 때 더 잘 배웁니다.', 'In my view와 when절을 포함했는지 평가합니다.', ['학생', '질문', '자유롭게'], 'In my view는 글쓴이의 의견을 나타냅니다.', '의견문 번역'],
      ['All visitors must sign in at the front desk before entering the meeting room.', '모든 방문객은 회의실에 들어가기 전에 접수대에서 서명해야 합니다.', 'must sign in과 before entering을 정확히 옮겼는지 평가합니다.', ['방문객', '접수대', '서명'], 'must는 의무를 나타냅니다.', '규칙 번역'],
      ['The apartment is near the station, but it is too noisy at night.', '그 아파트는 역과 가깝지만 밤에는 너무 시끄럽습니다.', 'near the station과 but 뒤의 단점을 모두 포함했는지 평가합니다.', ['아파트', '역', '시끄럽'], 'but은 장점과 단점을 대조합니다.', '대조 번역'],
      ['The company changed its delivery schedule to reduce delays during busy hours.', '그 회사는 바쁜 시간대의 지연을 줄이기 위해 배송 일정을 바꾸었습니다.', 'to reduce delays의 목적을 자연스럽게 번역했는지 평가합니다.', ['회사', '배송', '지연'], 'to reduce는 줄이기 위해라는 목적 표현입니다.', '목적 표현 번역'],
      ['Clear instructions can prevent mistakes when new employees learn a task.', '새 직원들이 업무를 배울 때 명확한 지시는 실수를 막을 수 있습니다.', 'prevent mistakes와 when절을 포함했는지 평가합니다.', ['지시', '실수', '직원'], 'prevent는 막다라는 뜻입니다.', '일반 진술 번역'],
      ['Although the ticket was expensive, the performance was worth the price.', '표는 비쌌지만 그 공연은 가격만큼 가치가 있었습니다.', 'Although와 worth the price를 자연스럽게 옮겼는지 평가합니다.', ['표', '비쌌', '가치'], 'Although는 양보를 나타냅니다.', '양보 구문 번역'],
      ['The manager asked everyone to submit the form by Friday afternoon.', '관리자는 모두에게 금요일 오후까지 양식을 제출하라고 요청했습니다.', 'asked everyone to와 submit the form을 포함했는지 평가합니다.', ['관리자', '금요일', '제출'], 'submit은 제출하다라는 뜻입니다.', '업무 지시 번역'],
      ['People are more likely to recycle when bins are clearly labeled.', '분리수거함에 라벨이 명확히 붙어 있을 때 사람들은 재활용할 가능성이 더 높습니다.', 'more likely to와 clearly labeled를 정확히 옮겼는지 평가합니다.', ['사람들', '재활용', '라벨'], 'be likely to는 ~할 가능성이 있다는 뜻입니다.', '가능성 표현 번역'],
      ['The workshop was useful because it gave beginners practical examples.', '그 워크숍은 초보자들에게 실제적인 예시를 제공했기 때문에 유용했습니다.', 'useful, beginners, practical examples를 포함했는지 평가합니다.', ['워크숍', '초보자', '예시'], 'practical은 실제적인이라는 뜻입니다.', '평가 표현 번역'],
    ],
    conversationChoice: [
      ['약속 시간을 바꾸고 싶을 때 가장 자연스러운 표현을 고르세요.', undefined, 'Could we meet thirty minutes later?', 'We meet late thirty minutes?', 'I later you meeting.', 'Could we는 정중하게 제안하거나 요청할 때 자연스럽습니다.', '일정 조정 표현'],
      ['상대방의 말을 다시 확인하는 표현을 고르세요.', undefined, 'So, you mean the meeting starts at nine?', 'You meaning meeting nine start?', 'Nine meeting means start you.', 'So, you mean ...은 들은 내용을 확인할 때 씁니다.', '확인 질문'],
      ['가볍게 의견을 묻는 표현을 고르세요.', undefined, 'What do you think about this design?', 'What you think this design?', 'How thinking design?', 'What do you think about ...?은 의견을 묻는 기본 표현입니다.', '의견 묻기'],
      ['정중하게 도움을 요청하는 표현을 고르세요.', undefined, 'Could you help me print this file?', 'Help me print this file now.', 'You printing help file?', 'Could you help me ...?은 공손한 도움 요청입니다.', '정중한 요청'],
      ['상대의 제안을 부드럽게 거절하는 표현을 고르세요.', undefined, 'Thanks, but I already have plans tonight.', 'No. I do not go.', 'I plans tonight already thanks but have.', '감사를 먼저 말하고 이유를 덧붙이면 부드럽게 거절할 수 있습니다.', '부드러운 거절'],
      ['문제 상황을 설명하고 해결을 요청하는 표현을 고르세요.', undefined, 'The Wi-Fi is not working. Could you check it?', 'Wi-Fi no work you check?', 'Check working Wi-Fi not.', '문제를 먼저 말하고 Could you로 요청하면 자연스럽습니다.', '문제 설명과 요청'],
      ['상대방의 좋은 소식에 반응하는 표현을 고르세요.', undefined, 'That is great news. Congratulations!', 'I do not care your news.', 'News great is congratulations that.', '좋은 소식에는 축하와 긍정적인 반응이 적절합니다.', '축하 표현'],
      ['식당에서 주문을 바꾸고 싶을 때 자연스러운 표현을 고르세요.', undefined, 'Excuse me, could I change my order?', 'Change my order, excuse.', 'I order changing could?', 'Excuse me와 could I를 사용하면 정중한 요청이 됩니다.', '식당 요청'],
    ],
    conversationWriting: [
      ['친구에게 주말 계획을 묻는 문장을 영어로 쓰세요.', undefined, 'What are you planning to do this weekend?', '주말 계획을 묻는 자연스러운 의문문인지 평가합니다.', ['what', 'planning', 'weekend'], 'be planning to는 예정된 계획을 물을 때 유용합니다.', '계획 묻기'],
      ['동료에게 보고서를 내일까지 보내 달라고 정중히 요청하세요.', undefined, 'Could you send me the report by tomorrow?', 'Could you와 by tomorrow를 사용했는지 평가합니다.', ['could you', 'report', 'tomorrow'], '업무 요청에서는 정중한 표현과 기한이 중요합니다.', '업무 요청'],
      ['늦게 답장해서 미안하다고 말하고 이유를 간단히 쓰세요.', undefined, 'Sorry for the late reply. I was busy with work.', '사과 표현과 간단한 이유가 포함되었는지 평가합니다.', ['sorry', 'late reply', 'busy'], 'Sorry for ...는 짧은 사과 메시지에 자주 쓰입니다.', '사과 메시지'],
      ['상대방의 의견에 부분적으로 동의하는 문장을 쓰세요.', undefined, 'I partly agree with you, but I think we need more time.', '부분 동의와 자신의 의견을 but으로 연결했는지 평가합니다.', ['partly agree', 'but', 'think'], 'partly agree는 완전한 동의가 아닐 때 쓸 수 있습니다.', '부분 동의'],
      ['가게 직원에게 환불이 가능한지 정중히 물어보세요.', undefined, 'Could I get a refund for this item?', 'Could I와 refund를 사용해 정중하게 묻는지 평가합니다.', ['could i', 'refund', 'item'], '환불 요청에서는 Could I get a refund ...?가 자연스럽습니다.', '환불 요청'],
      ['회의에서 잘 이해하지 못한 부분을 다시 설명해 달라고 요청하세요.', undefined, 'Could you explain that part again?', 'Could you explain과 again을 사용했는지 평가합니다.', ['could you', 'explain', 'again'], '설명이 더 필요할 때 explain that part again이라고 말할 수 있습니다.', '설명 요청'],
      ['친구에게 추천을 부탁하는 문장을 쓰세요.', undefined, 'Can you recommend a good restaurant near here?', 'recommend와 near here를 사용했는지 평가합니다.', ['recommend', 'restaurant', 'near here'], 'recommend는 추천하다라는 뜻입니다.', '추천 요청'],
      ['상대에게 방해해서 미안하다고 말하고 질문해도 되는지 물어보세요.', undefined, 'Sorry to bother you, but can I ask a question?', 'Sorry to bother you와 ask a question을 사용했는지 평가합니다.', ['sorry to bother', 'ask', 'question'], '대화를 시작할 때 부담을 줄이는 표현입니다.', '정중한 대화 시작'],
    ],
    grammarChoice: [
      ['가장 자연스러운 현재완료 문장을 고르세요.', undefined, 'I have lived here for three years.', 'I live here since three years.', 'I have live here for three years.', '기간을 나타내는 for와 현재완료 have lived를 씁니다.', '현재완료'],
      ['관계대명사가 올바르게 쓰인 문장을 고르세요.', undefined, 'This is the teacher who helped me.', 'This is the teacher which helped me.', 'This is the teacher helped who me.', '사람을 설명할 때 who를 사용합니다.', '관계대명사 who'],
      ['수동태 문장으로 알맞은 것을 고르세요.', undefined, 'The room is cleaned every morning.', 'The room cleans every morning.', 'The room is clean every morning by.', '수동태는 be동사와 과거분사 cleaned를 함께 씁니다.', '수동태'],
      ['미래 가능성을 말하는 조건문으로 가장 자연스러운 문장을 고르세요.', undefined, 'If it rains tomorrow, we will stay home.', 'If it will rain tomorrow, we stay home.', 'If it rains tomorrow, we stayed home.', '실제 가능성이 있는 조건은 If + 현재, will + 동사원형입니다.', '조건문 1형식'],
      ['간접화법으로 알맞은 문장을 고르세요.', 'Direct speech: She said, "I am tired."', 'She said that she was tired.', 'She said that I am tired.', 'She said that she is tired yesterday.', '과거 said 뒤에서는 am이 was로 바뀌고 주어도 she로 맞춥니다.', '간접화법'],
      ['비교급 문장으로 알맞은 것을 고르세요.', undefined, 'This bag is lighter than that one.', 'This bag is more light than that one.', 'This bag is lightest than that one.', 'light의 비교급은 lighter이며 than과 함께 씁니다.', '비교급'],
      ['동명사가 자연스러운 문장을 고르세요.', undefined, 'I enjoy cooking with my friends.', 'I enjoy cook with my friends.', 'I enjoy to cooking with my friends.', 'enjoy 뒤에는 동명사를 씁니다.', '동명사'],
      ['알맞은 조동사를 고르세요.', 'You ___ wear a helmet when you ride a motorcycle. It is the law.', 'must', 'might', 'used to', '법이나 강한 의무를 말할 때 must가 적절합니다.', '의무 조동사'],
      ['분사 형용사가 자연스러운 문장을 고르세요.', undefined, 'The movie was exciting.', 'The movie was excited.', 'The movie was excite.', '사물이 사람에게 느낌을 주면 exciting을 씁니다.', '분사 형용사'],
      ['목적어를 두 개 쓰는 문장을 고르세요.', undefined, 'She gave me a ticket.', 'She gave to me a ticket.', 'She gave I a ticket.', 'give는 give someone something 구조를 쓸 수 있습니다.', '수여동사'],
    ],
    grammarWriting: [
      ['현재완료를 사용해 나는 이미 숙제를 끝냈다고 쓰세요.', undefined, 'I have already finished my homework.', 'have already finished의 어순을 평가합니다.', ['have', 'already', 'finished'], 'already는 완료된 일을 강조할 때 자주 씁니다.', '현재완료 쓰기'],
      ['who를 사용해 두 문장을 연결하세요: I met a woman. She works at the bank.', undefined, 'I met a woman who works at the bank.', 'who로 사람을 설명했는지 평가합니다.', ['woman', 'who', 'works'], 'woman을 뒤에서 설명하므로 who works at the bank를 붙입니다.', '관계절 쓰기'],
      ['수동태로 바꾸세요: They make this bread every morning.', undefined, 'This bread is made every morning.', 'is made 구조를 사용했는지 평가합니다.', ['bread', 'is made', 'morning'], '현재 수동태는 is 또는 are + 과거분사입니다.', '수동태 전환'],
      ['If를 사용해 시간이 있으면 너에게 전화할게를 영어로 쓰세요.', undefined, 'If I have time, I will call you.', 'If + 현재, will + 동사원형 구조를 평가합니다.', ['if', 'have time', 'will call'], '미래 조건문에서는 if절에 현재시제를 씁니다.', '조건문 쓰기'],
      ['비교급을 사용해 기차가 버스보다 더 빠르다고 쓰세요.', undefined, 'The train is faster than the bus.', 'faster than 구조를 사용했는지 평가합니다.', ['train', 'faster than', 'bus'], '두 대상을 비교할 때 비교급 + than을 사용합니다.', '비교급 쓰기'],
      ['although를 사용해 비쌌지만 샀다고 쓰세요.', undefined, 'Although it was expensive, I bought it.', 'although와 과거시제를 사용했는지 평가합니다.', ['although', 'expensive', 'bought'], 'although는 양보를 나타내는 접속사입니다.', '양보절 쓰기'],
    ],
  },
  B2: {
    readingChoice: [
      ['Many cities are replacing wide roads with bike lanes. Critics argue this slows traffic, but supporters say it reduces pollution.', '도시의 자전거 도로 확대에 대한 찬반 의견을 비교합니다.', '자전거 제조 방법만 설명합니다.', '자동차를 즉시 금지해야 한다고 증명합니다.', 'critics와 supporters가 서로 다른 의견을 제시합니다.', '글의 목적 파악'],
      ['The new policy will be introduced gradually so that employees can get used to it.', '새 정책은 직원들이 적응할 수 있도록 점진적으로 도입됩니다.', '새 정책은 경고 없이 갑자기 중단됩니다.', '새 정책은 고위 직원에게만 적용됩니다.', 'gradually는 서서히 또는 점진적으로라는 뜻입니다.', '문맥 속 어휘'],
      ['Although the restaurant had excellent reviews, Mina decided not to go because reservations were required weeks in advance.', '미나는 더 빨리 갈 수 있는 식당을 원했을 가능성이 큽니다.', '그 식당은 이미 폐업했습니다.', '미나는 온라인 리뷰가 있는 식당을 싫어합니다.', '몇 주 전 예약이 필요해서 가지 않기로 했다는 점에서 추론할 수 있습니다.', '암시 정보 추론'],
      ['Remote work gives flexibility, but it can make communication harder for some teams.', '원격근무는 유연성을 주지만 팀 소통을 어렵게 할 수 있습니다.', '원격근무는 모든 회의를 없애야 한다는 뜻입니다.', '원격근무는 항상 사무실 근무보다 나쁩니다.', 'but 뒤에 장점과 대비되는 문제점이 제시됩니다.', '요지 파악'],
      ['Despite the delay, the research team believed extra testing would make the product safer.', '연구팀은 지연에도 불구하고 추가 테스트를 긍정적으로 봅니다.', '연구팀은 제품을 포기했습니다.', '연구팀은 안전성 검사를 거부했습니다.', 'Despite는 반대 상황에도 이어지는 태도를 보여 줍니다.', '글의 어조'],
      ['The product was expensive. However, many customers chose it because of its excellent warranty.', '비쌌지만 좋은 보증 때문에 많은 고객이 선택했습니다.', '저렴해서 모든 고객이 선택했습니다.', '보증이 없어서 아무도 사지 않았습니다.', 'However가 가격과 선택 이유의 대조를 연결합니다.', '논리 연결어'],
      ['Some schools rely heavily on educational apps, but teachers worry students may become less independent.', '교사들은 학생들이 앱에 지나치게 의존할까 봐 우려합니다.', '교사들은 모든 앱 사용을 금지했습니다.', '학생들은 앱 없이 더 의존적입니다.', 'worry that 이하가 핵심 우려입니다.', '핵심 우려 파악'],
      ['A four-day workweek requires clearer priorities, fewer unnecessary meetings, and better use of technology.', '짧은 근무 주간은 더 똑똑한 업무 조직을 요구합니다.', '회의 시간을 항상 늘려야 합니다.', '기술 사용을 피해야 합니다.', 'clearer priorities와 fewer meetings가 조직 방식 개선을 말합니다.', '주제문 파악'],
      ['The museum extended evening hours, yet visitor numbers barely changed.', '운영 시간뿐 아니라 접근성 같은 다른 요소도 중요할 수 있습니다.', '박물관 방문객은 더 이상 관심이 없습니다.', '저녁 프로그램은 반드시 없애야 합니다.', 'yet과 barely changed에서 단순 시간 연장만으로 충분하지 않음을 알 수 있습니다.', '추론 독해'],
      ['Local farmers use sensors to monitor soil conditions. They help farmers decide when crops need water.', 'They는 sensors를 가리킵니다.', 'They는 soil conditions를 가리킵니다.', 'They는 crops를 가리킵니다.', '농부들이 물 줄 시점을 판단하도록 돕는 것은 sensors입니다.', '대명사 지칭'],
      ['Electric buses are costly at first, but they require less maintenance and produce no exhaust fumes.', '전기 버스는 장기적으로 가치 있는 투자가 될 수 있습니다.', '전기 버스는 구매 비용이 항상 가장 낮습니다.', '도시는 대중교통을 중단해야 합니다.', '초기 비용과 장기 이점을 함께 비교하고 있습니다.', '결론 추론'],
      ['Survey results should be interpreted carefully because the sample may not represent the whole population.', '표본이 전체 집단을 대표하지 못할 수 있어 결과 해석에 주의해야 합니다.', '설문은 항상 완벽하게 정확합니다.', '표본이 작을수록 전체를 더 잘 대표합니다.', 'represent는 대표하다라는 뜻입니다.', '학술 어휘'],
    ],
    readingTranslation: [
      ['Many cities are replacing wide roads with bike lanes to reduce pollution and improve public health.', '많은 도시들이 오염을 줄이고 공중 보건을 개선하기 위해 넓은 도로를 자전거 도로로 바꾸고 있습니다.', '목적 표현 to reduce와 improve를 정확히 옮겼는지 평가합니다.', ['도시', '오염', '건강'], 'replace A with B는 A를 B로 대체한다는 뜻입니다.', '목적 표현 번역'],
      ['The manager said the new policy would be introduced gradually so employees could get used to it.', '관리자는 직원들이 적응할 수 있도록 새 정책이 점진적으로 도입될 것이라고 말했습니다.', 'would be introduced와 gradually를 자연스럽게 번역했는지 평가합니다.', ['정책', '점진적', '적응'], '수동태와 목적절을 함께 이해해야 합니다.', '복합문 번역'],
      ['Although remote work offers flexibility, it can also make communication more difficult for some teams.', '원격근무는 유연성을 제공하지만 일부 팀에게는 의사소통을 더 어렵게 만들 수도 있습니다.', 'Although와 make communication difficult 구조를 포함했는지 평가합니다.', ['원격근무', '유연성', '의사소통'], 'Although는 양보 관계를 나타냅니다.', '양보 구문 번역'],
      ['The museum extended its evening hours, yet visitor numbers barely changed.', '박물관은 저녁 운영 시간을 연장했지만 방문객 수는 거의 변하지 않았습니다.', 'yet과 barely changed의 대조 의미를 번역했는지 평가합니다.', ['박물관', '연장', '변하지'], 'barely는 거의 ~하지 않다는 뜻입니다.', '대조 번역'],
      ['Because the company simplified its return process, customer complaints dropped sharply.', '회사가 반품 절차를 간소화했기 때문에 고객 불만이 급격히 줄었습니다.', 'simplified, return process, dropped sharply를 포함했는지 평가합니다.', ['반품', '절차', '불만'], 'dropped sharply는 급격히 감소했다는 뜻입니다.', '원인 결과 번역'],
      ['Monitoring can reveal productivity problems, but it may reduce trust if employees feel constantly watched.', '감시는 생산성 문제를 드러낼 수 있지만 직원들이 계속 감시받는다고 느끼면 신뢰를 떨어뜨릴 수 있습니다.', '장점과 조건부 단점을 모두 옮겼는지 평가합니다.', ['감시', '생산성', '신뢰'], 'if절이 부정적 결과의 조건을 나타냅니다.', '균형 의견 번역'],
      ['The proposal, which was submitted last week, still needs approval.', '지난주 제출된 그 제안서는 아직 승인이 필요합니다.', '비제한적 관계절 which was submitted를 자연스럽게 번역했는지 평가합니다.', ['제안서', '지난주', '승인'], 'which절은 proposal을 추가 설명합니다.', '관계절 번역'],
      ['No sooner had the announcement been made than people started asking questions.', '발표가 이루어지자마자 사람들이 질문하기 시작했습니다.', 'No sooner ... than 구조를 자연스럽게 옮겼는지 평가합니다.', ['발표', '하자마자', '질문'], 'No sooner had ... than은 ~하자마자라는 뜻입니다.', '도치 구문 번역'],
      ['The more carefully you check the data, the fewer errors you are likely to find later.', '자료를 더 꼼꼼히 확인할수록 나중에 발견할 오류는 더 적을 가능성이 큽니다.', 'the 비교급, the 비교급 구조를 정확히 번역했는지 평가합니다.', ['자료', '확인', '오류'], '상관 비교급은 비례 관계를 나타냅니다.', '비교급 상관구문 번역'],
      ['Had I known about the delay, I would have taken a later train.', '그 지연에 대해 알았더라면 나는 더 늦은 기차를 탔을 것입니다.', '가정법 과거완료의 반대 사실 의미를 옮겼는지 평가합니다.', ['알았더라면', '기차', '탔을'], 'Had I known은 If I had known과 같은 의미입니다.', '가정법 번역'],
      ['Artificial intelligence can support doctors, but it should not replace professional judgment.', '인공지능은 의사를 도울 수 있지만 전문적인 판단을 대체해서는 안 됩니다.', 'support와 replace professional judgment를 정확히 옮겼는지 평가합니다.', ['인공지능', '의사', '판단'], 'replace는 대체하다라는 뜻입니다.', '대조 주장 번역'],
      ['More people are borrowing rarely used items instead of buying them to save money and reduce waste.', '더 많은 사람들이 돈을 아끼고 낭비를 줄이기 위해 잘 쓰지 않는 물건을 사는 대신 빌리고 있습니다.', 'instead of buying과 목적 표현을 포함했는지 평가합니다.', ['빌리', '사는 대신', '낭비'], 'instead of는 ~대신에라는 뜻입니다.', '소비 경향 번역'],
    ],
    conversationChoice: [
      ['업무 일정 연장을 요청하는 자연스러운 표현을 고르세요.', 'You cannot finish a report by Friday.', 'How much extra time do you need?', 'Why did you finish it yesterday?', 'Would you like to cancel lunch?', '추가 시간이 필요하다는 상황에는 필요한 기간을 묻는 말이 자연스럽습니다.', '업무 대화 흐름'],
      ['상대의 제안을 정중하게 거절하는 표현을 고르세요.', 'Your colleague suggests another daily meeting.', 'I see the value, but I am concerned it may add too much pressure.', 'That idea is completely ridiculous.', 'I never attend meetings at any time.', '상대 의견을 인정하면서 우려를 말하면 정중한 거절이 됩니다.', '정중한 반대'],
      ['대화의 의도로 가장 알맞은 표현을 고르세요.', 'Would you mind looking over my presentation slides before tomorrow?', 'A is asking for feedback.', 'A is refusing to present.', 'A is inviting B to a party.', 'look over는 검토해 달라는 의미입니다.', '요청 의도 파악'],
      ['상황에 맞는 가장 자연스러운 응답을 고르세요.', 'I heard your interview did not go as well as you hoped.', 'Yes, but I learned what to improve next time.', 'No, I have never heard of interviews.', 'Please turn off the printer.', '좋지 않은 결과에 대해 배운 점을 말하는 응답이 자연스럽습니다.', '공감과 후속 반응'],
      ['완곡한 반대 표현의 기능을 고르세요.', 'I am not sure that would solve the main issue.', 'expressing disagreement carefully', 'confirming a hotel reservation', 'asking for directions', '직접 반대하지 않고 해결책에 의문을 제기하는 표현입니다.', '완곡한 의견 표현'],
      ['조건을 붙여 수락하는 표현을 고르세요.', 'I can summarize the discussion, ___ someone shares the notes with me.', 'as long as', 'even though', 'instead of', 'as long as는 ~하기만 한다면이라는 조건을 나타냅니다.', '조건 표현'],
      ['대안을 부드럽게 제시하는 표현을 고르세요.', 'You want to suggest another approach.', 'Perhaps we could consider a different approach.', 'We must do exactly what I say.', 'There is no possible alternative.', 'Perhaps와 could가 제안을 부드럽게 만듭니다.', '부드러운 제안'],
      ['마감이 앞당겨졌을 때 실용적인 반응을 고르세요.', 'The deadline has been moved up to Wednesday.', 'That is not ideal, but we can manage if we divide the tasks today.', 'I do not care about deadlines.', 'There is no work in this project.', '어려움을 인정하면서 해결 방안을 제시하고 있습니다.', '협조적 태도'],
    ],
    conversationWriting: [
      ['친구의 의견에 부분적으로 동의하면서 다른 관점을 제시하세요.', 'Friend: Studying abroad is always better than studying in your own country.', 'I agree that studying abroad can broaden your perspective, but staying in your own country can also be valuable.', '부분 동의와 반대 관점을 모두 제시했는지 평가합니다.', ['agree', 'but', 'valuable'], 'B2 회화에서는 단정적인 반박보다 균형 잡힌 응답이 좋습니다.', '부분 동의 표현'],
      ['상품이 파손되어 도착한 상황에서 정중하게 불만을 제기하는 첫 문장을 쓰세요.', undefined, 'I am writing to let you know that the product I received arrived damaged.', '정중한 어조로 문제 상황을 분명히 설명했는지 평가합니다.', ['writing to let you know', 'product', 'damaged'], '불만 제기는 문제 사실을 명확히 전달하는 방식이 적절합니다.', '정중한 불만 제기'],
      ['회의에서 상대의 마지막 요점을 설명해 달라고 요청하세요.', undefined, 'Could you clarify what you meant by the last point?', 'clarify와 last point를 사용했는지 평가합니다.', ['clarify', 'meant', 'point'], '회의에서는 clarify로 설명 요청을 할 수 있습니다.', '설명 요청'],
      ['친구에게 큰 결정을 내리기 전 시간을 더 가져 보라고 조심스럽게 조언하세요.', undefined, 'Maybe you should give yourself more time before making such a big decision.', 'Maybe와 should를 사용해 부드럽게 조언했는지 평가합니다.', ['maybe', 'should', 'decision'], '조언할 때 maybe를 쓰면 강한 어조를 줄일 수 있습니다.', '조심스러운 조언'],
      ['프로젝트 일정 변경을 팀원에게 알리는 짧은 메시지를 쓰세요.', 'The meeting has been moved from Monday morning to Tuesday afternoon.', 'Please note that our meeting has been moved from Monday morning to Tuesday afternoon.', '변경 전후 일정이 명확한지 평가합니다.', ['meeting', 'moved', 'monday', 'tuesday'], '일정 변경 안내는 간결하고 정확해야 합니다.', '일정 변경 안내'],
      ['상대 주장을 일부 인정한 뒤, 반대 의견을 영어로 쓰세요.', 'Online reviews are useless because they are only personal opinions.', 'Although online reviews are subjective, they can still reveal common patterns.', 'Although로 부분 인정 후 반박했는지 평가합니다.', ['although', 'subjective', 'patterns'], 'Although는 "비록 ~이지만"처럼 일부를 인정한 뒤 다른 결론을 말할 때 쓸 수 있습니다.', '논리적 반박'],
      ['팀 회의에서 우려를 정중하게 표현하세요.', 'You think the plan may take more time than expected.', 'I am concerned that this plan may take longer than expected.', 'I am concerned that과 longer than expected를 사용했는지 평가합니다.', ['concerned', 'longer', 'expected'], '우려를 말할 때 I am concerned that ...이 자연스럽습니다.', '우려 표현'],
      ['고객에게 지연에 대해 사과하고 곧 업데이트하겠다고 쓰세요.', undefined, 'We apologize for the delay and will update you as soon as possible.', 'apologize, delay, update를 포함했는지 평가합니다.', ['apologize', 'delay', 'update'], '업무 메시지에서는 사과와 다음 조치를 함께 말합니다.', '업무 사과'],
    ],
    grammarChoice: [
      ['문법적으로 가장 자연스러운 문장을 고르세요.', undefined, 'Had I known about the delay, I would have taken a later train.', 'Had I knew about the delay, I will take a later train.', 'If I know about the delay, I would have took a later train.', '과거 사실의 반대를 나타내는 가정법 과거완료입니다.', '가정법 과거완료'],
      ['빈칸에 들어갈 가장 알맞은 표현을 고르세요.', 'The proposal, ___ was submitted last week, still needs approval.', 'which', 'what', 'who', '사물을 설명하는 비제한적 관계절에는 which를 씁니다.', '관계대명사'],
      ['빈칸에 들어갈 가장 알맞은 표현을 고르세요.', 'By the time we arrived, the lecture ___.', 'had already begun', 'has already begun', 'already begins', '도착한 과거 시점보다 강의 시작이 더 이전이므로 과거완료가 필요합니다.', '과거완료'],
      ['피곤했지만 계속 일했다는 뜻을 가장 자연스럽게 나타내는 문장을 고르세요.', undefined, 'Despite feeling tired, he continued working on the project.', 'Despite he felt tired, he continued working on the project.', 'Despite of feeling tired, he continued working on the project.', 'Despite 뒤에는 명사나 동명사 형태가 옵니다.', '비록 ~이지만 표현'],
      ['빈칸에 들어갈 가장 알맞은 조동사를 고르세요.', 'You ___ have told me earlier; now it is too late to change the booking.', 'should', 'may', 'can', 'should have p.p.는 과거에 하지 않은 일에 대한 후회나 비판을 나타냅니다.', '조동사 완료형'],
      ['빈칸에 들어갈 가장 알맞은 표현을 고르세요.', 'The more carefully you check the data, ___ errors you are likely to find later.', 'the fewer', 'the least', 'the fewest', 'the 비교급, the 비교급 구조이므로 the fewer가 알맞습니다.', '비교급 상관구문'],
      ['Not only로 시작할 때 어순이 가장 자연스러운 문장을 고르세요.', undefined, 'Not only did she finish the report, but she also presented it clearly.', 'Not only she finished the report, but also presented it clearly.', 'Not only did she finished the report, but she also presents it clearly.', 'Not only가 문두에 오면 did she처럼 조동사와 주어의 순서가 바뀝니다.', 'Not only 어순'],
      ['빈칸에 들어갈 가장 알맞은 표현을 고르세요.', 'I would rather you ___ the information confidential for now.', 'kept', 'keep', 'will keep', 'would rather 뒤에 다른 주어가 오면 과거형을 씁니다.', 'would rather 구문'],
      ['빈칸에 들어갈 가장 알맞은 표현을 고르세요.', 'No sooner had the announcement been made ___ people started asking questions.', 'than', 'when', 'while', 'No sooner had ... than 구조가 맞습니다.', '상관 접속 표현'],
      ['직원들에게 인기가 없어서 정책이 빨리 수정됐다는 뜻을 짧게 표현한 문장을 고르세요.', 'Because the policy was unpopular, it was revised quickly.', 'Unpopular with employees, the policy was revised quickly.', 'Unpopularing employees, the policy revised quickly.', 'Being unpopularity, the policy was revise quickly.', '이유를 짧게 앞에 붙일 때는 Unpopular with employees처럼 형용사구를 사용할 수 있습니다.', '이유를 줄여 말하기'],
    ],
    grammarWriting: [
      ['두 문장을 한 문장으로 자연스럽게 줄여 쓰세요: She realized the mistake. She immediately contacted the client.', undefined, 'Realizing the mistake, she immediately contacted the client.', '앞 행동과 뒤 행동의 주어가 같은지 평가합니다.', ['realizing', 'mistake', 'contacted'], '두 동작의 주어가 같으므로 Realizing the mistake로 시작해 자연스럽게 줄일 수 있습니다.', '문장 줄여 쓰기'],
      ['수동태로 바꾸세요: The committee will review all applications next month.', undefined, 'All applications will be reviewed by the committee next month.', '미래 수동태 will be reviewed를 사용했는지 평가합니다.', ['applications', 'will be reviewed', 'committee'], '미래 수동태는 will be + 과거분사입니다.', '미래 수동태'],
      ['간접화법으로 바꾸세요: Manager: “We are considering a new schedule.”', undefined, 'The manager said that they were considering a new schedule.', '시제 이동과 said를 자연스럽게 사용했는지 평가합니다.', ['manager said', 'were considering', 'schedule'], 'are considering은 전달문에서 were considering으로 바뀝니다.', '간접화법'],
      ['so that 구문을 사용해 쓰세요: 그녀는 모든 사람이 이해할 수 있도록 천천히 설명했다.', undefined, 'She explained it slowly so that everyone could understand.', '목적을 나타내는 so that을 사용했는지 평가합니다.', ['explained', 'so that', 'understand'], 'so that 뒤에는 목적을 나타내는 절이 옵니다.', '목적절'],
      ['가정법 과거완료로 쓰세요: 알았더라면 너에게 말했을 텐데.', undefined, 'If I had known, I would have told you.', 'If I had known과 would have told를 사용했는지 평가합니다.', ['had known', 'would have told'], '과거 사실의 반대를 말할 때 가정법 과거완료를 씁니다.', '가정법 쓰기'],
      ['Not only로 시작해 "보고서도 끝냈고 발표도 잘했다"는 뜻을 강조해서 쓰세요.', undefined, 'Not only did she finish the report, but she also presented it clearly.', 'Not only did she와 but she also 구조를 평가합니다.', ['not only', 'did she', 'but she also'], 'Not only가 문두에 오면 did she처럼 조동사와 주어의 순서가 바뀝니다.', 'Not only 강조'],
    ],
  },
};

function tupleToReadingChoice(tuple) {
  const [source, correct, wrongOne, wrongTwo, explanationKo, weakPointLabel] = tuple;
  return { source, correct, wrongOne, wrongTwo, explanationKo, weakPointLabel };
}

function tupleToReadingTranslation(tuple) {
  const [
    source,
    sampleAnswer,
    evaluationFocusKo,
    expectedKeywordsKo,
    explanationKo,
    weakPointLabel,
  ] = tuple;
  return {
    source,
    sampleAnswer,
    evaluationFocusKo,
    expectedKeywords: expectedKeywordsKo,
    expectedKeywordsKo,
    explanationKo,
    weakPointLabel,
  };
}

function tupleToInteraction(tuple) {
  const [
    promptKo,
    questionText,
    correct,
    wrongOne,
    wrongTwo,
    explanationKo,
    weakPointLabel,
  ] = tuple;
  return { promptKo, questionText, correct, wrongOne, wrongTwo, explanationKo, weakPointLabel };
}

function tupleToWriting(tuple) {
  const [
    promptKo,
    questionText,
    sampleAnswer,
    evaluationFocusKo,
    expectedKeywords,
    explanationKo,
    weakPointLabel,
  ] = tuple;
  return {
    promptKo,
    questionText,
    sampleAnswer,
    evaluationFocusKo,
    expectedKeywords,
    explanationKo,
    weakPointLabel,
  };
}

function buildExtraQuestions() {
  return LEVELS.flatMap((level) => {
    const levelContent = content[level];
    const questions = [
      ...levelContent.readingChoice
        .map(tupleToReadingChoice)
        .map((item, index) => readingChoice(level, index, item)),
      ...levelContent.readingTranslation
        .map(tupleToReadingTranslation)
        .map((item, index) => readingTranslation(level, index, item)),
      ...levelContent.conversationChoice
        .map(tupleToInteraction)
        .map((item, index) => conversationChoice(level, index, item)),
      ...levelContent.conversationWriting
        .map(tupleToWriting)
        .map((item, index) => conversationWriting(level, index, item)),
      ...levelContent.grammarChoice
        .map(tupleToInteraction)
        .map((item, index) => grammarChoice(level, index, item)),
      ...levelContent.grammarWriting
        .map(tupleToWriting)
        .map((item, index) => grammarWriting(level, index, item)),
    ];

    if (questions.length !== EXTRA_PER_LEVEL) {
      throw new Error(`${level} generated ${questions.length}, expected ${EXTRA_PER_LEVEL}`);
    }

    return questions;
  });
}

function extractArrayLiteral(source, exportName) {
  const marker = `export const ${exportName}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Could not find ${exportName}`);
  }

  const assignmentIndex = source.indexOf('=', markerIndex);
  if (assignmentIndex === -1) {
    throw new Error(`Could not find assignment for ${exportName}`);
  }

  const start = source.indexOf('[', assignmentIndex);
  if (start === -1) {
    throw new Error(`Could not find array for ${exportName}`);
  }

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Could not extract ${exportName} array literal`);
}

function evaluateArrayLiteral(literal, scope = {}) {
  const names = Object.keys(scope);
  const values = Object.values(scope);
  return Function(...names, `"use strict"; return (${literal});`)(...values);
}

function readArrayFromTs(filePath, exportName, scope) {
  const source = readFileSync(filePath, 'utf8');
  return evaluateArrayLiteral(extractArrayLiteral(source, exportName), scope);
}

const generatedQuestions = buildExtraQuestions().map(normalizeEnglishWritingQuestionPrompt);
const generatedFile = join(dataRoot, 'generatedExtraQuestions.ts');
writeFileSync(
  generatedFile,
  `import type { LearningQuestion } from '../types/learning';\n\nexport const generatedExtraQuestions: LearningQuestion[] = ${JSON.stringify(
    generatedQuestions,
    null,
    2,
  )};\n`,
  'utf8',
);

const readingTranslationQuestions = readArrayFromTs(
  join(dataRoot, 'readingTranslationQuestions.ts'),
  'readingTranslationQuestions',
);
const generatedDoubleQuestions = readArrayFromTs(
  join(dataRoot, 'generatedDoubleQuestions.ts'),
  'generatedDoubleQuestions',
);
const questionBank = readArrayFromTs(join(dataRoot, 'questionBank.ts'), 'questionBank', {
  generatedDoubleQuestions,
  generatedExtraQuestions: generatedQuestions,
  readingTranslationQuestions,
}).map(normalizeEnglishWritingQuestionPrompt);

mkdirSync(packsRoot, { recursive: true });

const manifest = {
  schemaVersion: SCHEMA_VERSION,
  publishedAt: PUBLISHED_AT,
  packs: LEVELS.map((level) => {
    const questions = questionBank.filter((question) => question.level === level);
    if (questions.length !== TARGET_PER_LEVEL) {
      throw new Error(`${level} has ${questions.length} questions, expected ${TARGET_PER_LEVEL}`);
    }

    const pack = {
      schemaVersion: SCHEMA_VERSION,
      level,
      version: PACK_VERSION,
      publishedAt: PUBLISHED_AT,
      questions,
    };

    const fileName = `${level.toLowerCase()}.v${PACK_VERSION}.json`;
    writeFileSync(join(packsRoot, fileName), `${JSON.stringify(pack, null, 2)}\n`, 'utf8');

    return {
      level,
      version: PACK_VERSION,
      path: `packs/${fileName}`,
      questionCount: questions.length,
    };
  }),
};

writeFileSync(join(publicRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Generated ${generatedQuestions.length} extra questions.`);
console.log(`Published ${LEVELS.length} packs with ${TARGET_PER_LEVEL} questions per level.`);

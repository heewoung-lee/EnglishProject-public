#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const outputPath = join(appRoot, 'src', 'data', 'generatedDoubleQuestions.ts');
const levels = ['A1', 'A2', 'B1', 'B2'];
const readingDifficulties = ['easy', 'medium', 'hard'];
const readingTimeLimits = {
  A1: [30, 45, 60],
  A2: [45, 60, 75],
  B1: [60, 75, 90],
  B2: [75, 90, 90],
};

function pad(index) {
  return String(index + 1).padStart(3, '0');
}

function koreanKeywords(text) {
  const tokens = text.match(/[가-힣]+/g) ?? [];
  const uniqueTokens = [...new Set(tokens.filter((token) => token.length > 1))];

  return uniqueTokens.slice(0, 3);
}

function englishKeywords(text) {
  const ignored = new Set([
    'about',
    'after',
    'again',
    'also',
    'before',
    'could',
    'should',
    'that',
    'their',
    'there',
    'this',
    'with',
    'would',
  ]);
  const tokens = text
    .toLowerCase()
    .match(/[a-z']+/g)
    ?.filter((token) => token.length > 2 && !ignored.has(token)) ?? [];

  return [...new Set(tokens)].slice(0, 4);
}

function rotateChoice(items, index, offset) {
  return items[(index + offset) % items.length].ko;
}

function makeChoiceQuestion({
  level,
  area,
  group,
  index,
  promptKo,
  questionText,
  choices,
  explanationKo,
  weakPointLabel,
}) {
  return {
    id: `${level.toLowerCase()}-double-${group}-${pad(index)}`,
    level,
    area,
    kind: 'choice',
    promptKo,
    ...(questionText ? { questionText } : {}),
    choices: [
      { id: 'a', text: choices[0] },
      { id: 'b', text: choices[1] },
      { id: 'c', text: choices[2] },
    ],
    correctChoiceId: 'a',
    explanationKo,
    weakPointLabel,
  };
}

function makeTranslationQuestion(level, index, item) {
  return {
    id: `${level.toLowerCase()}-double-reading-translation-${pad(index)}`,
    level,
    area: 'reading',
    kind: 'writing',
    promptKo: '영어 지문을 읽고 한글로 번역하세요.',
    questionText: item.en,
    sampleAnswer: item.ko,
    evaluationFocusKo: '영어 지문의 핵심 의미를 자연스러운 한국어로 옮겼는지 평가합니다.',
    answerLanguage: 'ko',
    expectedKeywordsKo: koreanKeywords(item.ko),
    readingDifficulty: readingDifficulties[index % readingDifficulties.length],
    timeLimitSeconds: readingTimeLimits[level][index % 3],
    explanationKo: `${item.focus}을 자연스럽게 옮기는 것이 핵심입니다.`,
    weakPointLabel: item.weak,
  };
}

function removeFirstAuxiliary(sentence) {
  const stripped = sentence.replace(
    /\b(am|are|is|was|were|be|been|being|do|does|did|has|have|had|will|would|could|should|can)\b\s+/i,
    '',
  );

  return stripped === sentence ? sentence.replace(/\b(a|an|the)\b\s+/i, '') : stripped;
}

function swapFirstTwoWords(sentence) {
  const words = sentence.split(' ');

  if (words.length < 3) {
    return `${sentence} me`;
  }

  [words[0], words[1]] = [words[1], words[0]];
  return words.join(' ');
}

function normalizeChoiceText(value) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function makeDistinctWrongChoices(sample) {
  const wrongChoices = [
    removeFirstAuxiliary(sample),
    swapFirstTwoWords(sample),
    `Not ${sample.charAt(0).toLowerCase()}${sample.slice(1)}`,
    `${sample.replace(/[?.!]$/, '')} before?`,
  ];
  const used = new Set([normalizeChoiceText(sample)]);

  return wrongChoices.filter((choice) => {
    const normalizedChoice = normalizeChoiceText(choice);

    if (used.has(normalizedChoice)) {
      return false;
    }

    used.add(normalizedChoice);
    return true;
  }).slice(0, 2);
}

function makeExpressionChoice(level, group, index, target) {
  const wrongChoices = makeDistinctWrongChoices(target.sample);

  return makeChoiceQuestion({
    level,
    area: 'conversation',
    group,
    index,
    promptKo: target.promptKo,
    questionText: target.context,
    choices: [
      target.sample,
      ...wrongChoices,
    ],
    explanationKo: target.explanationKo,
    weakPointLabel: target.weak,
  });
}

function makeGrammarChoice(level, index, target) {
  const wrongChoices = makeDistinctWrongChoices(target.sample);

  return makeChoiceQuestion({
    level,
    area: 'grammar',
    group: 'grammar-choice',
    index,
    promptKo: `다음 뜻을 가장 자연스러운 영어 문장으로 고르세요: ${target.ko}`,
    choices: [
      target.sample,
      ...wrongChoices,
    ],
    explanationKo: target.explanationKo,
    weakPointLabel: target.weak,
  });
}

function makeEnglishWritingQuestion(level, area, group, index, target) {
  return {
    id: `${level.toLowerCase()}-double-${group}-${pad(index)}`,
    level,
    area,
    kind: 'writing',
    promptKo: `다음 문장을 영어로 쓰세요: ${target.ko}`,
    sampleAnswer: target.sample,
    evaluationFocusKo: target.focus,
    expectedKeywords: englishKeywords(target.sample),
    explanationKo: target.explanationKo,
    weakPointLabel: target.weak,
  };
}

const readingItems = {
  A1: [
    ['The library opens at nine.', '도서관은 9시에 엽니다.', 'opens at nine', '시간 정보'],
    ['The cafe closes at six.', '카페는 6시에 닫습니다.', 'closes at six', '시간 정보'],
    ['The station is near the hotel.', '역은 호텔 근처에 있습니다.', 'near the hotel', '장소 관계'],
    ['The bank is next to the market.', '은행은 시장 옆에 있습니다.', 'next to the market', '장소 관계'],
    ['My brother plays tennis on Sunday.', '내 남동생은 일요일에 테니스를 칩니다.', 'plays tennis on Sunday', '요일 표현'],
    ['My sister studies English after dinner.', '내 여동생은 저녁 식사 후 영어를 공부합니다.', 'after dinner', '시간 순서'],
    ['The blue notebook is on the desk.', '파란 공책은 책상 위에 있습니다.', 'on the desk', '위치 표현'],
    ['The small key is in the bag.', '작은 열쇠는 가방 안에 있습니다.', 'in the bag', '위치 표현'],
    ['Please write your address here.', '여기에 주소를 써 주세요.', 'write your address', '기본 요청'],
    ['Please call me before lunch.', '점심 전에 저에게 전화해 주세요.', 'before lunch', '시간 요청'],
    ['I bought a gift for my friend.', '나는 친구를 위해 선물을 샀습니다.', 'for my friend', '목적 표현'],
    ['We need more water for the trip.', '우리는 여행을 위해 물이 더 필요합니다.', 'more water for the trip', '필요 표현'],
    ['The movie is short but funny.', '그 영화는 짧지만 재미있습니다.', 'short but funny', '대조 표현'],
    ['This soup is hot, so be careful.', '이 수프는 뜨거우니 조심하세요.', 'hot, so be careful', '결과 표현'],
    ['The children are drawing pictures.', '아이들은 그림을 그리고 있습니다.', 'are drawing pictures', '현재진행형'],
    ['I lost my wallet this morning.', '나는 오늘 아침 지갑을 잃어버렸습니다.', 'lost my wallet', '과거 표현'],
    ['The red shoes are under the bed.', '빨간 신발은 침대 아래에 있습니다.', 'under the bed', '위치 표현'],
    ['He drinks milk every morning.', '그는 매일 아침 우유를 마십니다.', 'every morning', '일상 행동'],
    ['The doctor is in the room.', '의사는 방 안에 있습니다.', 'in the room', '장소 표현'],
    ['The store sells fresh bread.', '그 가게는 신선한 빵을 팝니다.', 'sells fresh bread', '상점 표현'],
    ['The park is behind the school.', '공원은 학교 뒤에 있습니다.', 'behind the school', '위치 관계'],
    ['I walk to work every day.', '나는 매일 직장까지 걸어갑니다.', 'walk to work', '일상 행동'],
    ['The green cup is mine.', '초록색 컵은 내 것입니다.', 'is mine', '소유 표현'],
    ['They eat lunch at twelve.', '그들은 12시에 점심을 먹습니다.', 'lunch at twelve', '시간 정보'],
    ['The bus is late today.', '버스가 오늘 늦습니다.', 'late today', '상태 표현'],
    ['Mina has two pencils.', '미나는 연필 두 자루를 가지고 있습니다.', 'has two pencils', '수량 표현'],
    ['The milk is in the fridge.', '우유는 냉장고 안에 있습니다.', 'in the fridge', '위치 표현'],
    ['We visit our grandmother every month.', '우리는 매달 할머니를 방문합니다.', 'every month', '빈도 표현'],
    ['The cat sleeps on the sofa.', '고양이는 소파 위에서 잡니다.', 'on the sofa', '위치 표현'],
    ['I need a new notebook for class.', '나는 수업에 새 공책이 필요합니다.', 'need a new notebook', '필요 표현'],
    ['She washes her hands before dinner.', '그녀는 저녁 식사 전에 손을 씻습니다.', 'before dinner', '시간 순서'],
    ['The door is open.', '문이 열려 있습니다.', 'is open', '상태 표현'],
  ],
  A2: [
    ['The meeting starts at two, but the room opens at one thirty.', '회의는 2시에 시작하지만 방은 1시 30분에 열립니다.', 'starts, but opens', '시간 정보 비교'],
    ['Please bring a jacket because it may be cold in the evening.', '저녁에 추울 수 있으니 재킷을 가져와 주세요.', 'because it may be cold', '이유 파악'],
    ['The office is closed on Friday for a staff workshop.', '직원 워크숍 때문에 금요일에는 사무실이 쉽니다.', 'closed on Friday', '공지 이해'],
    ['If you buy two sandwiches, you get one drink for free.', '샌드위치 두 개를 사면 음료 하나를 무료로 받습니다.', 'if, get one free', '조건 이해'],
    ['The hotel shuttle leaves every thirty minutes from Gate 4.', '호텔 셔틀은 4번 게이트에서 30분마다 출발합니다.', 'every thirty minutes', '교통 안내'],
    ['I returned the shoes because the size was too small.', '사이즈가 너무 작아서 신발을 반품했습니다.', 'returned because too small', '원인과 행동'],
    ['The library card is free, but you need an ID to make one.', '도서관 카드는 무료지만 만들려면 신분증이 필요합니다.', 'free, but need ID', '조건 정보'],
    ['The concert was moved indoors because of heavy rain.', '폭우 때문에 콘서트가 실내로 옮겨졌습니다.', 'moved indoors', '날씨와 일정'],
    ['Guests should check out before eleven to avoid an extra fee.', '추가 요금을 피하려면 11시 전에 체크아웃해야 합니다.', 'before eleven', '규칙 이해'],
    ['The package arrived late, but nothing was damaged.', '소포는 늦게 도착했지만 손상된 것은 없었습니다.', 'late, but not damaged', '대조 이해'],
    ['You can borrow up to three books at a time.', '한 번에 책을 세 권까지 빌릴 수 있습니다.', 'up to three books', '수량 제한'],
    ['The cooking class includes all ingredients, so you do not need to bring anything.', '요리 수업에는 모든 재료가 포함되어 있어서 아무것도 가져올 필요가 없습니다.', 'includes all ingredients', '수업 안내'],
    ['The bank will be open until noon on Saturday.', '은행은 토요일 정오까지 문을 엽니다.', 'until noon', '영업시간'],
    ['Please upload the file again because the first one was blank.', '첫 번째 파일이 비어 있어서 파일을 다시 업로드해 주세요.', 'upload again because blank', '업무 안내'],
    ['The tour guide will meet everyone in front of the museum.', '가이드는 박물관 앞에서 모두를 만날 예정입니다.', 'in front of the museum', '장소 파악'],
    ['The app works offline after you download the lesson.', '수업을 다운로드한 뒤에는 앱을 오프라인으로 사용할 수 있습니다.', 'after you download', '기능 설명'],
    ['The restaurant was full, so we waited for a table outside.', '식당이 가득 차서 우리는 밖에서 자리를 기다렸습니다.', 'full, so waited outside', '상황 이해'],
    ['Please send the form before the office closes.', '사무실이 문을 닫기 전에 양식을 보내 주세요.', 'before the office closes', '시간 접속사'],
    ['I changed my password because I could not log in.', '로그인할 수 없어서 비밀번호를 바꿨습니다.', 'could not log in', '문제 상황'],
    ['The museum ticket is cheaper online than at the door.', '박물관 표는 현장보다 온라인에서 더 쌉니다.', 'cheaper online', '비교 표현'],
    ['We need to leave early to catch the first train.', '첫 기차를 타려면 우리는 일찍 출발해야 합니다.', 'to catch the first train', '목적 표현'],
    ['The class was canceled because the teacher was sick.', '선생님이 아파서 수업이 취소되었습니다.', 'was canceled', '수동태 이해'],
    ['Could you print this document for tomorrow morning?', '내일 아침까지 이 문서를 출력해 주시겠어요?', 'print this document', '정중한 요청'],
    ['I usually check the weather before I ride my bike.', '나는 자전거를 타기 전에 보통 날씨를 확인합니다.', 'usually check', '습관 표현'],
    ['The room was quiet, so I could focus on my work.', '방이 조용해서 나는 일에 집중할 수 있었습니다.', 'could focus', '결과 표현'],
    ['Please keep your receipt in case you need a refund.', '환불이 필요할 경우를 대비해 영수증을 보관해 주세요.', 'in case refund', '조건 표현'],
    ['The new schedule is easier to understand than the old one.', '새 일정은 예전 것보다 이해하기 쉽습니다.', 'easier than', '비교급'],
    ['We could not enter the building without a visitor pass.', '방문증 없이는 건물에 들어갈 수 없었습니다.', 'without a visitor pass', '부정 조건'],
    ['The store offers free delivery for orders over fifty dollars.', '그 가게는 50달러 초과 주문에 무료 배송을 제공합니다.', 'orders over fifty dollars', '조건 정보'],
    ['I saved the address so I can find the cafe later.', '나중에 카페를 찾을 수 있도록 주소를 저장했습니다.', 'so I can find', '목적 표현'],
    ['The bus was crowded, but I found a seat near the back.', '버스는 붐볐지만 뒤쪽 근처에서 자리를 찾았습니다.', 'crowded, but found a seat', '대조 표현'],
    ['Please arrive ten minutes early for the interview.', '면접에는 10분 일찍 도착해 주세요.', 'arrive early', '일정 안내'],
  ],
  B1: [
    ['Although the price was high, the laptop sold out within a day.', '가격이 높았지만 그 노트북은 하루 안에 매진되었습니다.', 'Although, sold out', '대조 관계'],
    ['The company delayed the launch to fix a security issue.', '회사는 보안 문제를 해결하기 위해 출시를 늦췄습니다.', 'to fix a security issue', '목적 파악'],
    ['Applicants must submit a portfolio unless they have previous work experience.', '지원자는 이전 경력이 없으면 포트폴리오를 제출해야 합니다.', 'unless they have experience', '조건 이해'],
    ['The survey found that remote workers saved time but missed casual conversations.', '설문은 재택근무자가 시간을 절약했지만 가벼운 대화를 그리워했다는 점을 보여 줍니다.', 'saved time but missed', '장단점 파악'],
    ['The road will remain closed until engineers confirm that the bridge is safe.', '기술자들이 다리가 안전하다고 확인할 때까지 도로는 계속 폐쇄됩니다.', 'until engineers confirm', '조건과 시간'],
    ['The new policy reduced waiting times, especially during busy hours.', '새 정책은 특히 바쁜 시간대의 대기 시간을 줄였습니다.', 'reduced waiting times', '결과 이해'],
    ['The speaker avoided technical terms so the audience could follow the presentation.', '발표자는 청중이 발표를 따라올 수 있도록 전문 용어를 피했습니다.', 'so the audience could follow', '목적 파악'],
    ['The team revised the design after users said the buttons were hard to find.', '사용자들이 버튼을 찾기 어렵다고 해서 팀은 디자인을 수정했습니다.', 'after users said', '피드백 이해'],
    ['Despite the short deadline, the editor reviewed every page carefully.', '마감이 짧았음에도 편집자는 모든 페이지를 꼼꼼히 검토했습니다.', 'Despite the deadline', '반대 상황'],
    ['The app reminds users to review words they answered incorrectly.', '앱은 사용자가 틀린 단어를 복습하도록 알려 줍니다.', 'reminds users to review', '기능 설명'],
    ['The manager accepted the proposal after the team clarified the budget.', '팀이 예산을 명확히 설명한 후 관리자는 제안을 받아들였습니다.', 'after clarified the budget', '업무 맥락'],
    ['The article argues that small habits can lead to significant changes over time.', '그 글은 작은 습관이 시간이 지나며 큰 변화로 이어질 수 있다고 주장합니다.', 'lead to changes', '중심 주장'],
    ['The repair took longer than expected because one part had to be ordered.', '부품 하나를 주문해야 해서 수리가 예상보다 오래 걸렸습니다.', 'because one part', '이유 파악'],
    ['The course is designed for people who can already hold simple conversations.', '그 강좌는 이미 간단한 대화를 할 수 있는 사람들을 위해 설계되었습니다.', 'people who can', '대상 파악'],
    ['The city added more signs so visitors would not get lost near the station.', '시는 방문객이 역 근처에서 길을 잃지 않도록 표지판을 더 설치했습니다.', 'so visitors would not get lost', '목적 이해'],
    ['The review praised the restaurant for its service but criticized the limited menu.', '리뷰는 서비스는 칭찬했지만 제한적인 메뉴는 비판했습니다.', 'praised but criticized', '평가 대조'],
    ['The team changed the plan after reviewing user feedback.', '팀은 사용자 피드백을 검토한 후 계획을 변경했습니다.', 'after reviewing feedback', '시간 순서'],
    ['This feature allows learners to practice weak areas more often.', '이 기능은 학습자가 약한 영역을 더 자주 연습할 수 있게 합니다.', 'allows learners to practice', '기능 설명'],
    ['The report compares online shopping with visiting stores in person.', '그 보고서는 온라인 쇼핑과 직접 매장 방문을 비교합니다.', 'compares A with B', '비교 번역'],
    ['The company apologized for the delay and offered a discount.', '회사는 지연에 대해 사과하고 할인을 제공했습니다.', 'apologized and offered', '업무 문장'],
    ['The article suggests taking short breaks to stay focused.', '그 글은 집중을 유지하기 위해 짧은 휴식을 취하라고 제안합니다.', 'suggests taking breaks', '조언 이해'],
    ['Even though the instructions were clear, some users skipped the final step.', '안내가 명확했음에도 일부 사용자는 마지막 단계를 건너뛰었습니다.', 'Even though, skipped', '대조 번역'],
    ['The workshop is useful for employees who write emails in English.', '그 워크숍은 영어로 이메일을 쓰는 직원들에게 유용합니다.', 'employees who write', '관계절 이해'],
    ['The manager asked the team to finish the draft by Friday.', '관리자는 팀에게 금요일까지 초안을 끝내 달라고 요청했습니다.', 'asked the team to', '요청 보고'],
    ['The update fixed several bugs but made the app slower.', '업데이트는 여러 버그를 고쳤지만 앱을 더 느리게 만들었습니다.', 'fixed but made slower', '대조 번역'],
    ['People who exercise regularly tend to sleep better.', '규칙적으로 운동하는 사람들은 더 잘 자는 경향이 있습니다.', 'tend to sleep better', '일반화'],
    ['The candidate explained why the previous project had failed.', '그 지원자는 이전 프로젝트가 왜 실패했는지 설명했습니다.', 'explained why', '간접의문문'],
    ['The new rule applies to anyone who uses the shared kitchen.', '새 규칙은 공용 주방을 사용하는 모든 사람에게 적용됩니다.', 'applies to anyone', '규칙 이해'],
    ['The teacher encouraged students to ask questions during the lesson.', '선생님은 수업 중에 학생들이 질문하도록 격려했습니다.', 'encouraged students to', '권유 표현'],
    ['The chart shows that sales increased steadily after April.', '그 도표는 4월 이후 매출이 꾸준히 증가했음을 보여 줍니다.', 'increased steadily', '자료 설명'],
    ['The hotel upgraded our room because the original one was not ready.', '원래 방이 준비되지 않아서 호텔은 우리 방을 업그레이드해 주었습니다.', 'because not ready', '호텔 상황'],
    ['Although the train was delayed, we arrived before the meeting started.', '기차가 지연되었지만 우리는 회의가 시작되기 전에 도착했습니다.', 'Although delayed', '복합문 이해'],
  ],
  B2: [
    ['The proposal gained support because it addressed both cost concerns and environmental goals.', '그 제안은 비용 우려와 환경 목표를 모두 다루었기 때문에 지지를 얻었습니다.', 'addressed both concerns and goals', '복합 이유 파악'],
    ['Rather than replacing teachers, the tool is intended to reduce repetitive administrative work.', '그 도구는 교사를 대체하기보다 반복적인 행정 업무를 줄이려는 목적입니다.', 'Rather than replacing', '목적과 대조'],
    ['The researcher cautioned that the sample was too small to support a broad conclusion.', '연구자는 표본이 너무 작아 넓은 결론을 뒷받침하기 어렵다고 경고했습니다.', 'too small to support', '연구 한계'],
    ['The policy may improve efficiency, provided that privacy safeguards are enforced.', '개인정보 보호 장치가 시행된다면 그 정책은 효율성을 높일 수 있습니다.', 'provided that', '조건부 주장'],
    ['While the campaign attracted attention, it failed to change long-term behavior.', '그 캠페인은 관심을 끌었지만 장기 행동 변화에는 실패했습니다.', 'While, failed to change', '성과 평가'],
    ['The author implies that convenience alone is not enough to build lasting user habits.', '저자는 편리함만으로는 지속적인 사용자 습관을 만들기에 충분하지 않다고 암시합니다.', 'not enough to build habits', '함축 의미'],
    ['The company postponed the rollout after discovering inconsistencies in the test results.', '회사는 테스트 결과의 불일치를 발견한 후 출시를 연기했습니다.', 'after discovering inconsistencies', '업무 판단'],
    ['The article challenges the assumption that higher salaries always lead to better performance.', '그 글은 더 높은 급여가 항상 더 나은 성과로 이어진다는 가정에 의문을 제기합니다.', 'challenges the assumption', '주장 파악'],
    ['The plan is ambitious, yet its timeline appears realistic given the available resources.', '그 계획은 야심 차지만, 가용 자원을 고려하면 일정은 현실적으로 보입니다.', 'yet, given resources', '균형 평가'],
    ['The editor removed several examples because they distracted from the central argument.', '편집자는 중심 주장에 방해가 되었기 때문에 여러 예시를 삭제했습니다.', 'distracted from argument', '글 구조 이해'],
    ['The committee approved the budget only after the risks had been clearly explained.', '위원회는 위험이 명확히 설명된 뒤에야 예산을 승인했습니다.', 'only after risks explained', '조건 강조'],
    ['The study distinguishes between short-term satisfaction and long-term retention.', '그 연구는 단기 만족도와 장기 유지율을 구분합니다.', 'distinguishes between', '개념 구분'],
    ['The speaker conceded that the system was imperfect but argued that it was improving.', '발표자는 시스템이 완벽하지 않다는 점은 인정했지만 개선되고 있다고 주장했습니다.', 'conceded but argued', '양보 후 주장'],
    ['The new process reduced errors by requiring reviewers to check each step independently.', '새 절차는 검토자가 각 단계를 독립적으로 확인하게 하여 오류를 줄였습니다.', 'by requiring reviewers', '방법 파악'],
    ['The author questions whether rapid growth is sustainable without stronger internal systems.', '저자는 더 강한 내부 시스템 없이 빠른 성장이 지속 가능한지 의문을 제기합니다.', 'questions whether', '비판적 읽기'],
    ['The decision was not popular, but it prevented a more serious problem later.', '그 결정은 인기가 없었지만 나중에 더 심각한 문제를 막았습니다.', 'not popular, but prevented', '결과 평가'],
    ['The findings suggest that motivation declines when feedback is delayed for too long.', '그 결과는 피드백이 너무 오래 지연되면 동기가 떨어진다는 점을 시사합니다.', 'motivation declines', '연구 결과'],
    ['Rather than focusing only on speed, the team prioritized accuracy and user trust.', '팀은 속도에만 집중하기보다 정확성과 사용자 신뢰를 우선했습니다.', 'Rather than speed', '대조 번역'],
    ['The policy will be effective only if managers apply it consistently.', '관리자들이 그것을 일관되게 적용할 때에만 그 정책은 효과적일 것입니다.', 'only if consistently', '조건 번역'],
    ['The report does not reject the idea entirely; instead, it recommends a slower rollout.', '그 보고서는 그 아이디어를 완전히 거부하지 않고, 대신 더 느린 도입을 권장합니다.', 'instead recommends', '대안 표현'],
    ['By simplifying the form, the team reduced the number of incomplete applications.', '양식을 단순화함으로써 팀은 미완성 신청서 수를 줄였습니다.', 'By simplifying', '방법 표현'],
    ['The speaker acknowledged the criticism while defending the overall direction.', '발표자는 전체 방향을 옹호하면서도 비판을 인정했습니다.', 'acknowledged while defending', '균형 표현'],
    ['The evidence is persuasive, but it does not prove that the effect will last.', '그 증거는 설득력 있지만 그 효과가 지속된다는 것을 증명하지는 않습니다.', 'persuasive but does not prove', '한계 표현'],
    ['The committee delayed the decision until additional safety data became available.', '위원회는 추가 안전 데이터가 확보될 때까지 결정을 미뤘습니다.', 'until data became available', '의사결정'],
    ['The platform encourages users to review mistakes rather than repeat easy tasks.', '그 플랫폼은 사용자가 쉬운 과제를 반복하기보다 실수를 복습하도록 장려합니다.', 'rather than repeat', '학습 기능'],
    ['The article highlights the tension between personal convenience and public responsibility.', '그 글은 개인의 편리함과 공적 책임 사이의 긴장을 강조합니다.', 'tension between', '추상 개념'],
    ['The proposal was revised to address concerns raised during the public hearing.', '그 제안은 공청회에서 제기된 우려를 다루기 위해 수정되었습니다.', 'concerns raised', '수동 표현'],
    ['The company admitted that the original timeline had been overly optimistic.', '회사는 원래 일정이 지나치게 낙관적이었다는 점을 인정했습니다.', 'had been optimistic', '과거완료'],
    ['The system is designed to detect unusual activity before it becomes a serious risk.', '그 시스템은 이상 활동이 심각한 위험이 되기 전에 감지하도록 설계되었습니다.', 'designed to detect', '목적과 시간'],
    ['The author argues that transparency can reduce suspicion even when people disagree.', '저자는 사람들이 의견이 다르더라도 투명성이 의심을 줄일 수 있다고 주장합니다.', 'even when disagree', '주장 이해'],
    ['The transition was smoother than expected because employees received practical training.', '직원들이 실무 교육을 받았기 때문에 전환은 예상보다 더 순조로웠습니다.', 'smoother than expected', '비교 번역'],
    ['The results should be interpreted cautiously because the survey excluded smaller companies.', '그 설문이 소규모 기업을 제외했기 때문에 결과는 신중하게 해석되어야 합니다.', 'interpreted cautiously', '연구 한계'],
  ],
};

const conversationTargets = {
  A1: [
    ['길을 묻는 표현을 고르세요.', 'You need the station.', '역이 어디에 있나요?', 'Where is the station?', 'Where is ...?는 장소를 묻는 기본 표현입니다.', '길 묻기'],
    ['카페에서 차를 주문하는 표현을 고르세요.', 'You are at a cafe.', '차 한 잔 주세요.', 'Can I have tea, please?', 'Can I have ... please?는 주문할 때 자연스럽습니다.', '주문 표현'],
    ['상대에게 이름을 묻는 표현을 고르세요.', 'You meet someone new.', '이름이 무엇인가요?', 'What is your name?', 'What is your name?은 이름을 묻는 기본 질문입니다.', '이름 묻기'],
    ['감사에 답하는 표현을 고르세요.', 'Someone says thank you.', '천만에요.', 'You are welcome.', 'You are welcome은 감사에 답할 때 쓰는 표현입니다.', '감사 답변'],
    ['날씨를 묻는 표현을 고르세요.', 'You talk about weather.', '날씨가 어떤가요?', 'How is the weather?', 'How is the weather?는 날씨를 묻는 자연스러운 문장입니다.', '날씨 질문'],
    ['사진을 찍어 달라고 부탁하는 표현을 고르세요.', 'You need a photo.', '사진을 찍어 주실 수 있나요?', 'Can you take a picture?', 'Can you take a picture?는 사진 촬영을 부탁하는 표현입니다.', '부탁하기'],
    ['계산서를 요청하는 표현을 고르세요.', 'You finished eating.', '계산서를 주세요.', 'Can I have the bill, please?', 'Can I have the bill, please?는 계산서를 요청하는 표현입니다.', '식당 표현'],
    ['시간을 묻는 표현을 고르세요.', 'You need the time.', '지금 몇 시인가요?', 'What time is it?', 'What time is it?은 시간을 묻는 기본 표현입니다.', '시간 질문'],
    ['천천히 말해 달라는 표현을 고르세요.', 'The speaker is too fast.', '천천히 말해 주세요.', 'Please speak slowly.', 'Please speak slowly는 천천히 말해 달라는 요청입니다.', '속도 요청'],
    ['허락을 구하는 표현을 고르세요.', 'You want to sit.', '여기에 앉아도 될까요?', 'Can I sit here?', 'Can I ...?는 허락을 구할 때 씁니다.', '허락 구하기'],
    ['상대에게 괜찮은지 묻는 표현을 고르세요.', 'Your friend looks tired.', '괜찮나요?', 'Are you okay?', 'Are you okay?는 상대 상태를 묻는 자연스러운 표현입니다.', '상태 확인'],
    ['도움을 요청하는 표현을 고르세요.', 'You need help.', '저를 도와줄 수 있나요?', 'Can you help me?', 'Can you help me?는 도움을 요청하는 기본 표현입니다.', '도움 요청'],
    ['물 한 잔 주세요.', undefined, '물 한 잔 주세요.', 'Can I have a glass of water?', '음료를 요청할 때 Can I have ...?를 씁니다.', '기본 요청'],
    ['저는 서울에 삽니다.', undefined, '저는 서울에 삽니다.', 'I live in Seoul.', '사는 곳은 I live in + 장소로 말합니다.', '거주지 말하기'],
    ['다시 말해 주세요.', undefined, '다시 말해 주세요.', 'Please say that again.', '못 들었을 때 Please say that again이라고 말할 수 있습니다.', '되묻기'],
    ['저는 커피를 좋아하지 않습니다.', undefined, '저는 커피를 좋아하지 않습니다.', 'I do not like coffee.', '일반동사 부정문은 do not + 동사원형입니다.', '부정 표현'],
    ['화장실이 어디에 있나요?', undefined, '화장실이 어디에 있나요?', 'Where is the restroom?', '장소를 물을 때 Where is ...?를 씁니다.', '장소 질문'],
    ['오늘은 날씨가 좋습니다.', undefined, '오늘은 날씨가 좋습니다.', 'The weather is nice today.', '날씨를 말할 때 The weather is ... 구조가 자연스럽습니다.', '날씨 표현'],
    ['저는 버스를 기다리고 있습니다.', undefined, '저는 버스를 기다리고 있습니다.', 'I am waiting for the bus.', '기다리다는 wait for로 표현합니다.', '현재진행형'],
    ['이것은 얼마인가요?', undefined, '이것은 얼마인가요?', 'How much is this?', '가격은 How much is this?로 묻습니다.', '가격 질문'],
    ['내일 만나요.', undefined, '내일 만나요.', 'See you tomorrow.', 'See you tomorrow는 내일 보자는 인사입니다.', '작별 인사'],
    ['저는 배가 고픕니다.', undefined, '저는 배가 고픕니다.', 'I am hungry.', '배고픈 상태는 I am hungry라고 말합니다.', '상태 표현'],
    ['제 휴대폰을 찾고 있습니다.', undefined, '제 휴대폰을 찾고 있습니다.', 'I am looking for my phone.', '찾고 있다는 look for로 말합니다.', '찾기 표현'],
    ['천천히 걸어 주세요.', undefined, '천천히 걸어 주세요.', 'Please walk slowly.', '공손한 요청은 Please로 시작할 수 있습니다.', '요청 표현'],
  ],
  A2: [
    ['약속 시간을 바꾸자고 자연스럽게 제안하는 표현을 고르세요.', 'You need a new time.', '4시에 만날 수 있을까요?', 'Could we meet at four instead?', 'Could we ... instead?는 다른 시간을 제안할 때 자연스럽습니다.', '일정 변경'],
    ['가게 직원에게 환불을 정중히 묻는 표현을 고르세요.', 'You want a refund.', '이것을 환불받을 수 있을까요?', 'Could I get a refund for this?', 'Could I get a refund ...?는 정중한 환불 요청입니다.', '환불 요청'],
    ['길을 잘 못 알아들었을 때 다시 설명을 요청하는 표현을 고르세요.', 'You need clarification.', '그것을 다시 설명해 주시겠어요?', 'Could you explain that again?', 'Could you explain that again?은 다시 설명해 달라는 표현입니다.', '명확화 요청'],
    ['식당에서 추천을 묻는 표현을 고르세요.', 'You want a recommendation.', '무엇을 추천하시나요?', 'What do you recommend?', 'What do you recommend?는 추천을 묻는 자연스러운 표현입니다.', '추천 질문'],
    ['늦게 답장해서 미안하다고 말하는 표현을 고르세요.', 'You replied late.', '답장이 늦어서 죄송합니다.', 'Sorry for the late reply.', 'Sorry for the late reply는 늦은 답장에 대한 사과입니다.', '사과 표현'],
    ['문제를 설명하고 도움을 요청하는 표현을 고르세요.', 'Your app is not working.', '앱이 작동하지 않습니다. 도와주시겠어요?', 'The app is not working. Could you help me?', '문제를 먼저 말하고 Could you help me?로 도움을 요청합니다.', '문제 설명'],
    ['호텔에서 예약 확인을 요청하는 표현을 고르세요.', 'You are checking in.', '제 예약을 확인해 주시겠어요?', 'Could you check my reservation?', 'Could you check my reservation?은 예약 확인 요청입니다.', '호텔 체크인'],
    ['상대 의견에 짧게 동의하는 표현을 고르세요.', 'You agree.', '당신의 의견에 동의합니다.', 'I agree with you.', 'agree with someone 구조를 씁니다.', '동의 표현'],
    ['상대에게 이메일 주소를 다시 말해 달라고 하는 표현을 고르세요.', 'You missed the email address.', '이메일 주소를 다시 말해 주시겠어요?', 'Could you repeat your email address?', 'Could you repeat ...?는 다시 말해 달라는 정중한 표현입니다.', '되묻기'],
    ['약속에 늦을 것이라고 말하는 표현을 고르세요.', 'You will be late.', '10분 정도 늦을 것 같습니다.', 'I will be about ten minutes late.', 'will be late는 늦을 예정이라는 뜻입니다.', '지각 알림'],
    ['음식 알레르기를 알리는 표현을 고르세요.', 'You cannot eat peanuts.', '저는 땅콩 알레르기가 있습니다.', 'I am allergic to peanuts.', 'be allergic to는 알레르기가 있다는 표현입니다.', '건강 정보'],
    ['상대에게 편한 시간을 묻는 표현을 고르세요.', 'You need to schedule.', '몇 시가 괜찮으세요?', 'What time works for you?', 'What time works for you?는 가능한 시간을 묻는 표현입니다.', '일정 조율'],
    ['오늘 수업에 못 간다고 말해 주세요.', undefined, '오늘 수업에 못 갑니다.', "I can't come to class today.", "갈 수 없다는 말은 cannot 또는 can't로 표현합니다.", '불참 알림'],
    ['내일 다시 전화하겠다고 말해 주세요.', undefined, '내일 다시 전화하겠습니다.', 'I will call you again tomorrow.', '미래 행동은 will로 말할 수 있습니다.', '미래 표현'],
    ['영수증을 보여 달라고 정중히 요청해 주세요.', undefined, '영수증을 보여 주시겠어요?', 'Could you show me the receipt?', '정중한 요청은 Could you ...?로 시작합니다.', '정중한 요청'],
    ['회의 시간을 바꿀 수 있는지 물어보세요.', undefined, '회의 시간을 바꿀 수 있을까요?', 'Can we change the meeting time?', '함께 하는 일은 Can we ...?로 물을 수 있습니다.', '일정 변경'],
    ['이 근처에 약국이 있는지 물어보세요.', undefined, '이 근처에 약국이 있나요?', 'Is there a pharmacy near here?', '주변 장소를 물을 때 Is there ... near here?를 씁니다.', '장소 질문'],
    ['음식이 너무 맵다고 말해 주세요.', undefined, '이 음식은 너무 맵습니다.', 'This food is too spicy.', 'too는 지나치게라는 의미를 더합니다.', '상태 설명'],
    ['주문한 음료가 아직 안 나왔다고 말해 주세요.', undefined, '제 음료가 아직 나오지 않았습니다.', 'My drink has not arrived yet.', '아직 도착하지 않았다는 현재완료로 말할 수 있습니다.', '문제 설명'],
    ['이번 주말에 시간이 있는지 물어보세요.', undefined, '이번 주말에 시간이 있나요?', 'Are you free this weekend?', '상대가 시간이 있는지 Are you free ...?로 묻습니다.', '약속 질문'],
    ['가격이 생각보다 비싸다고 말해 주세요.', undefined, '가격이 생각보다 비쌉니다.', 'The price is higher than I expected.', '예상보다 높다는 higher than I expected로 말합니다.', '비교 표현'],
    ['예약을 취소하고 싶다고 말해 주세요.', undefined, '예약을 취소하고 싶습니다.', 'I would like to cancel my reservation.', 'I would like to ...는 정중한 의사 표현입니다.', '예약 취소'],
    ['문자를 보내 달라고 부탁해 주세요.', undefined, '문자를 보내 주시겠어요?', 'Could you send me a text message?', 'send me는 나에게 보내 달라는 뜻입니다.', '부탁하기'],
    ['잠시 기다려 달라고 말해 주세요.', undefined, '잠시 기다려 주시겠어요?', 'Could you wait a moment?', '잠시 기다려 달라는 요청은 wait a moment를 씁니다.', '대기 요청'],
  ],
  B1: [
    ['상대 의견에 부분적으로 동의한 뒤 다른 의견을 말하는 표현을 고르세요.', 'You partly disagree.', '부분적으로 동의하지만 저는 다르게 봅니다.', 'I partly agree, but I see it differently.', 'partly agree와 but을 함께 쓰면 부분 동의 후 다른 관점을 말할 수 있습니다.', '부분 동의'],
    ['보고서 마감 연장을 정중히 요청하는 표현을 고르세요.', 'You need more time.', '보고서를 끝내기 위해 하루 더 받을 수 있을까요?', 'Could I have one more day to finish the report?', 'Could I have one more day ...?는 시간을 더 요청하는 정중한 표현입니다.', '업무 요청'],
    ['회의에서 요점을 확인하는 표현을 고르세요.', 'You check understanding.', '그러면 핵심 문제는 일정이라는 말씀이죠?', 'So, the main issue is the schedule, right?', 'So, ... right?는 이해한 내용을 확인할 때 씁니다.', '요점 확인'],
    ['상대 제안에 대안을 제시하는 표현을 고르세요.', 'You suggest another option.', '그것도 가능하지만 다른 선택지도 시도해 볼 수 있습니다.', 'That could work, but we could also try another option.', 'That could work, but ...은 제안을 인정하고 대안을 제시합니다.', '대안 제시'],
    ['문제를 인정하고 해결하겠다고 말하는 표현을 고르세요.', 'You respond to a complaint.', '문제를 이해했습니다. 확인해 보겠습니다.', 'I understand the problem, and I will look into it.', 'I understand ... and I will look into it은 문제 대응 표현입니다.', '문제 대응'],
    ['자료를 다시 보내 달라고 정중히 요청하는 표현을 고르세요.', 'You cannot open the file.', '파일을 다시 보내 주시겠어요?', 'Could you send the file again?', 'Could you send ... again?은 다시 보내 달라는 요청입니다.', '파일 요청'],
    ['일정을 확정하기 전에 확인하겠다고 말하는 표현을 고르세요.', 'You need to check first.', '먼저 제 일정을 확인해 보겠습니다.', 'Let me check my schedule first.', 'Let me check ... first는 먼저 확인하겠다는 표현입니다.', '일정 확인'],
    ['상대의 설명을 더 구체적으로 요청하는 표현을 고르세요.', 'You need details.', '구체적인 예를 들어 주실 수 있나요?', 'Could you give me a specific example?', 'specific example은 구체적인 예시를 뜻합니다.', '상세 요청'],
    ['불편을 끼쳐 죄송하다고 말하는 표현을 고르세요.', 'You caused inconvenience.', '불편을 끼쳐 죄송합니다.', 'I apologize for the inconvenience.', 'I apologize for ...는 공식적인 사과 표현입니다.', '공식 사과'],
    ['진행 상황을 업데이트하겠다고 말하는 표현을 고르세요.', 'You will follow up.', '오늘 안에 업데이트해 드리겠습니다.', 'I will update you by the end of the day.', 'by the end of the day는 오늘 안에라는 뜻입니다.', '업무 알림'],
    ['상대의 우려를 이해한다고 말하는 표현을 고르세요.', 'You respond to concern.', '당신의 우려를 이해합니다.', 'I understand your concern.', 'I understand your concern은 상대 걱정을 인정하는 표현입니다.', '공감 표현'],
    ['결정을 미루자고 제안하는 표현을 고르세요.', 'You need more information.', '더 많은 정보를 얻은 뒤에 결정하는 것이 좋겠습니다.', 'Maybe we should decide after we get more information.', 'after we get more information은 정보 확보 후를 뜻합니다.', '결정 보류'],
    ['당신의 의견에 부분적으로 동의합니다.', undefined, '당신의 의견에 부분적으로 동의합니다.', 'I partly agree with your opinion.', '부분적으로 동의할 때 partly agree with를 쓸 수 있습니다.', '부분 동의'],
    ['보고서를 하루 더 늦게 제출해도 될까요?', undefined, '보고서를 하루 더 늦게 제출해도 될까요?', 'Could I submit the report one day later?', '정중히 허락을 구할 때 Could I를 씁니다.', '허락 요청'],
    ['요점을 다시 확인하고 싶습니다.', undefined, '요점을 다시 확인하고 싶습니다.', 'I would like to confirm the main point again.', '확인하고 싶다는 말은 would like to confirm으로 표현합니다.', '요점 확인'],
    ['다른 선택지도 검토해 보면 좋겠습니다.', undefined, '다른 선택지도 검토해 보면 좋겠습니다.', 'We should also consider another option.', '대안을 검토하자는 제안은 consider another option으로 말합니다.', '대안 제시'],
    ['불편을 끼쳐 죄송합니다.', undefined, '불편을 끼쳐 죄송합니다.', 'I apologize for the inconvenience.', '공식적인 사과에는 apologize for를 씁니다.', '공식 사과'],
    ['파일을 다시 보내 주시겠어요?', undefined, '파일을 다시 보내 주시겠어요?', 'Could you send the file again?', '다시 요청할 때 again을 덧붙입니다.', '파일 요청'],
    ['먼저 제 일정을 확인해 보겠습니다.', undefined, '먼저 제 일정을 확인해 보겠습니다.', 'Let me check my schedule first.', 'Let me check는 내가 확인해 보겠다는 뜻입니다.', '일정 확인'],
    ['구체적인 예를 들어 주실 수 있나요?', undefined, '구체적인 예를 들어 주실 수 있나요?', 'Could you give me a specific example?', '구체적인 예시는 specific example입니다.', '상세 요청'],
    ['오늘 안에 업데이트해 드리겠습니다.', undefined, '오늘 안에 업데이트해 드리겠습니다.', 'I will update you by the end of the day.', 'by the end of the day는 오늘 안에라는 뜻입니다.', '진행 알림'],
    ['당신의 우려를 이해합니다.', undefined, '당신의 우려를 이해합니다.', 'I understand your concern.', '상대 우려를 인정할 때 your concern을 씁니다.', '공감 표현'],
    ['더 많은 정보를 얻은 뒤에 결정합시다.', undefined, '더 많은 정보를 얻은 뒤에 결정합시다.', "Let's decide after we get more information.", "Let's는 함께 하자는 제안입니다.", '결정 제안'],
    ['그 문제를 확인해 보겠습니다.', undefined, '그 문제를 확인해 보겠습니다.', 'I will look into the issue.', 'look into는 문제를 조사해 보겠다는 뜻입니다.', '문제 대응'],
  ],
  B2: [
    ['강한 반대가 아니라 신중한 우려를 표현하는 문장을 고르세요.', 'You are concerned but polite.', '잠재적 장점은 보이지만 위험이 우려됩니다.', 'I see the potential benefits, but I am concerned about the risks.', '장점을 인정한 뒤 우려를 말하면 균형 잡힌 표현이 됩니다.', '균형 있는 의견'],
    ['회의에서 결정 근거를 요청하는 표현을 고르세요.', 'You need the reason.', '그 결정의 근거를 설명해 주시겠어요?', 'Could you explain the reasoning behind that decision?', 'reasoning behind a decision은 결정 근거를 뜻합니다.', '근거 요청'],
    ['일정은 가능하지만 범위를 줄여야 한다고 말하는 표현을 고르세요.', 'You negotiate scope.', '범위를 줄이면 일정은 가능합니다.', 'The timeline is possible if we reduce the scope.', 'if we reduce the scope가 가능한 조건입니다.', '범위 조정'],
    ['상대 주장에 양보 후 다른 관점을 제시하는 표현을 고르세요.', 'You respond in discussion.', '그건 타당한 지적이지만 저는 다르게 봅니다.', 'That is a fair point, but I would look at it another way.', 'fair point로 인정한 뒤 another way로 다른 관점을 말합니다.', '토론 표현'],
    ['추가 자료를 본 뒤 판단하겠다고 말하는 표현을 고르세요.', 'You need evidence.', '결정하기 전에 데이터를 검토하고 싶습니다.', 'I would prefer to review the data before making a decision.', 'before making a decision이 판단 전 조건입니다.', '신중한 결정'],
    ['공식 이메일에서 지연을 사과하는 표현을 고르세요.', 'You write formal email.', '지연에 대해 사과드리며 기다려 주셔서 감사합니다.', 'We apologize for the delay and appreciate your patience.', 'We apologize for ... and appreciate ...는 공식적인 사과 표현입니다.', '공식 이메일'],
    ['상대 제안을 바로 거절하지 않고 검토하겠다는 표현을 고르세요.', 'You respond to a proposal.', '제안을 검토한 뒤 다시 연락드리겠습니다.', 'I will review the proposal and get back to you.', 'get back to you는 다시 연락하겠다는 뜻입니다.', '검토 답변'],
    ['회의에서 이해한 내용을 요약하는 표현을 고르세요.', 'You summarize.', '요약하면 더 단순한 절차와 더 명확한 역할이 필요합니다.', 'To summarize, we need a simpler process and clearer roles.', 'To summarize로 요약을 시작할 수 있습니다.', '요약 표현'],
    ['상대에게 기준을 명확히 해 달라고 요청하는 표현을 고르세요.', 'You need criteria.', '승인 기준을 명확히 해 주시겠어요?', 'Could you clarify the criteria for approval?', 'criteria for approval은 승인 기준이라는 뜻입니다.', '기준 확인'],
    ['제안이 현실적인지 조심스럽게 묻는 표현을 고르세요.', 'You question feasibility.', '이 계획이 예산 안에서 현실적이라고 생각하시나요?', 'Do you think this plan is realistic within the budget?', 'within the budget은 예산 안에서라는 뜻입니다.', '실현 가능성 질문'],
    ['갈등을 줄이기 위해 공통점을 찾자는 표현을 고르세요.', 'You mediate.', '우리가 동의하는 지점부터 시작해 봅시다.', 'Maybe we can start with the points we agree on.', 'points we agree on은 동의하는 지점을 뜻합니다.', '중재 표현'],
    ['사용자 피드백을 다음 버전에 반영하겠다는 표현을 고르세요.', 'You discuss product work.', '사용자 피드백을 다음 버전에 반영하겠습니다.', 'We will incorporate user feedback into the next version.', 'incorporate A into B는 A를 B에 반영한다는 뜻입니다.', '제품 논의'],
    ['잠재적 장점은 보이지만 위험이 우려됩니다.', undefined, '잠재적 장점은 보이지만 위험이 우려됩니다.', 'I see the potential benefits, but I am concerned about the risks.', '장점과 우려를 함께 말할 때 but으로 관점을 전환합니다.', '균형 있는 의견'],
    ['그 결정의 근거를 설명해 주시겠어요?', undefined, '그 결정의 근거를 설명해 주시겠어요?', 'Could you explain the reasoning behind that decision?', '결정 근거는 reasoning behind that decision으로 말합니다.', '근거 요청'],
    ['범위를 줄이면 일정은 가능합니다.', undefined, '범위를 줄이면 일정은 가능합니다.', 'The timeline is possible if we reduce the scope.', '조건을 붙여 가능성을 말할 수 있습니다.', '범위 조정'],
    ['그건 타당한 지적이지만 저는 다르게 봅니다.', undefined, '그건 타당한 지적이지만 저는 다르게 봅니다.', 'That is a fair point, but I see it differently.', '상대 의견을 인정한 뒤 다른 관점을 제시합니다.', '토론 표현'],
    ['결정하기 전에 데이터를 검토하고 싶습니다.', undefined, '결정하기 전에 데이터를 검토하고 싶습니다.', 'I would like to review the data before making a decision.', '신중한 결정은 before making a decision으로 조건을 붙입니다.', '신중한 결정'],
    ['지연에 대해 사과드리며 기다려 주셔서 감사합니다.', undefined, '지연에 대해 사과드리며 기다려 주셔서 감사합니다.', 'We apologize for the delay and appreciate your patience.', '공식적인 사과와 감사 표현을 함께 쓸 수 있습니다.', '공식 이메일'],
    ['제안을 검토한 뒤 다시 연락드리겠습니다.', undefined, '제안을 검토한 뒤 다시 연락드리겠습니다.', 'I will review the proposal and get back to you.', 'get back to you는 다시 연락하겠다는 뜻입니다.', '검토 답변'],
    ['요약하면 더 단순한 절차와 더 명확한 역할이 필요합니다.', undefined, '요약하면 더 단순한 절차와 더 명확한 역할이 필요합니다.', 'To summarize, we need a simpler process and clearer roles.', '요약할 때 To summarize로 시작할 수 있습니다.', '요약 표현'],
    ['승인 기준을 명확히 해 주시겠어요?', undefined, '승인 기준을 명확히 해 주시겠어요?', 'Could you clarify the criteria for approval?', '기준을 명확히 해 달라는 요청입니다.', '기준 확인'],
    ['이 계획이 예산 안에서 현실적이라고 생각하시나요?', undefined, '이 계획이 예산 안에서 현실적이라고 생각하시나요?', 'Do you think this plan is realistic within the budget?', '상대 의견을 묻는 질문 구조를 사용합니다.', '실현 가능성 질문'],
    ['우리가 동의하는 지점부터 시작해 봅시다.', undefined, '우리가 동의하는 지점부터 시작해 봅시다.', "Let's start with the points we agree on.", '공통점을 찾을 때 points we agree on을 씁니다.', '중재 표현'],
    ['사용자 피드백을 다음 버전에 반영하겠습니다.', undefined, '사용자 피드백을 다음 버전에 반영하겠습니다.', 'We will incorporate user feedback into the next version.', 'incorporate A into B는 A를 B에 반영한다는 뜻입니다.', '제품 논의'],
  ],
};

const grammarTargets = {
  A1: [
    ['그는 선생님입니다.', 'He is a teacher.', 'He is와 a teacher 사용', '직업을 말할 때 단수명사 앞에 a를 붙입니다.', 'be동사 문장'],
    ['나는 사과 두 개를 가지고 있습니다.', 'I have two apples.', 'have와 복수명사 apples 사용', 'two 뒤에는 복수명사를 씁니다.', '복수 명사'],
    ['그들은 지금 공부하고 있습니다.', 'They are studying now.', 'are studying 현재진행형', '현재진행형은 be동사 + ing입니다.', '현재진행형 쓰기'],
    ['그녀는 매일 우유를 마십니다.', 'She drinks milk every day.', '3인칭 단수 drinks 사용', 'she 주어에는 동사에 s를 붙입니다.', '3인칭 단수'],
    ['나는 어제 집에 있었습니다.', 'I was at home yesterday.', 'was와 yesterday 사용', '과거의 상태는 was를 사용합니다.', '과거 be동사'],
    ['너는 영어를 좋아하니?', 'Do you like English?', 'Do you와 like 사용', '일반동사 의문문은 Do you + 동사원형입니다.', '의문문 쓰기'],
    ['책상 아래에 가방이 있습니다.', 'There is a bag under the desk.', 'There is와 under 사용', '존재와 위치를 함께 말할 수 있습니다.', '존재문'],
    ['나는 아침을 먹지 않습니다.', 'I do not eat breakfast.', 'do not eat 부정문', '일반동사 부정문은 do not + 동사원형입니다.', '부정문 쓰기'],
    ['이것은 내 지갑입니다.', 'This is my wallet.', 'This is와 my wallet 사용', '명사 앞에는 소유격 my를 씁니다.', '소유격'],
    ['문을 열어 주세요.', 'Please open the door.', 'Please와 open 사용', 'Please + 동사원형은 정중한 요청입니다.', '요청문'],
    ['우리는 일요일에 축구를 합니다.', 'We play soccer on Sundays.', 'play soccer와 on Sundays 사용', '요일에는 on을 씁니다.', '요일 표현'],
    ['그 책은 가방 안에 있습니다.', 'The book is in the bag.', 'in the bag 위치 표현', '가방 안은 in the bag으로 표현합니다.', '위치 전치사'],
    ['그녀는 펜을 가지고 있습니다.', 'She has a pen.', 'She has와 a pen 사용', '단수 셀 수 있는 명사 pen 앞에는 a를 씁니다.', '관사 사용'],
    ['의자가 두 개 있습니다.', 'There are two chairs.', 'There are와 복수명사 chairs 사용', 'two 뒤에는 복수명사 chairs를 씁니다.', '복수 명사'],
    ['그는 내 형입니다.', 'He is my brother.', 'He is와 my brother 사용', 'He에는 be동사 is를 씁니다.', 'be동사 일치'],
    ['그들은 피자를 좋아하나요?', 'Do they like pizza?', 'Do they와 like 사용', 'they 주어의 의문문은 Do they ...?입니다.', '의문문 어순'],
    ['우리는 지금 요리하고 있습니다.', 'We are cooking now.', 'are cooking 현재진행형', '현재진행형은 be동사 + 동사-ing입니다.', '현재진행형'],
    ['그녀는 어제 부산을 방문했습니다.', 'She visited Busan yesterday.', 'visited와 yesterday 사용', 'yesterday가 있으므로 과거형 visited를 씁니다.', '과거시제'],
    ['그 그림은 벽에 걸려 있습니다.', 'The picture is on the wall.', 'on the wall 위치 표현', '벽 표면 위에는 on the wall을 씁니다.', '전치사'],
    ['이것은 그녀의 책입니다.', 'This is her book.', 'her book 소유격 사용', '명사 앞에는 소유격 her를 씁니다.', '소유격'],
    ['나는 차가 없습니다.', 'I do not have a car.', 'do not have 부정문', 'I 주어에는 do not을 사용합니다.', '부정문'],
    ['문을 열어 줄 수 있나요?', 'Can you open the door?', 'Can you와 동사원형 open 사용', 'can 뒤에는 동사원형 open을 씁니다.', '조동사'],
    ['문을 닫아 주세요.', 'Please close the door.', 'Please와 close 사용', 'Please + 동사원형으로 정중한 명령을 만듭니다.', '정중한 명령문'],
    ['나는 7시에 일어납니다.', 'I get up at seven.', 'at seven 시간 전치사 사용', '시각 앞에는 at을 씁니다.', '시간 전치사'],
  ],
  A2: [
    ['나는 어제 지갑을 잃어버렸습니다.', 'I lost my wallet yesterday.', '과거형 lost와 yesterday 사용', 'yesterday가 있으면 과거시제를 사용합니다.', '과거시제'],
    ['그녀는 나보다 키가 큽니다.', 'She is taller than me.', 'taller than 비교급 사용', '비교할 때 형용사 비교급 + than을 씁니다.', '비교급'],
    ['몸이 아파서 집에 있었습니다.', 'I stayed home because I was sick.', 'because 이유절 사용', '이유를 말할 때 because를 사용할 수 있습니다.', '이유 연결'],
    ['숙제를 끝냈습니다.', 'I have finished my homework.', 'have finished 현재완료 사용', '완료된 경험이나 결과는 현재완료로 말할 수 있습니다.', '현재완료'],
    ['우리는 우유를 사려고 가게에 갔습니다.', 'We went to the store to buy milk.', 'to buy 목적 표현', '목적을 나타낼 때 to + 동사원형을 씁니다.', '목적 표현'],
    ['창문을 열어 주시겠어요?', 'Could you open the window?', 'Could you 정중한 요청', 'Could you 뒤에는 동사원형을 씁니다.', '정중한 요청'],
    ['내일 이모를 방문할 예정입니다.', 'I am going to visit my aunt tomorrow.', 'be going to 미래 표현', '계획된 미래는 be going to로 말할 수 있습니다.', '미래 표현'],
    ['나는 책 읽는 것을 즐깁니다.', 'I enjoy reading books.', 'enjoy 뒤 동명사 reading 사용', 'enjoy 뒤에는 동명사가 자연스럽습니다.', '동명사'],
    ['떠나기 전에 전화해 주세요.', 'Please call me before you leave.', 'before 시간 접속사 사용', 'before 뒤에 주어와 동사를 이어 시간 관계를 말합니다.', '시간 접속사'],
    ['물을 더 마셔야 합니다.', 'You should drink more water.', 'should 조언 표현', 'should 뒤에는 동사원형을 씁니다.', '조언 표현'],
    ['그 상자는 너무 무거워서 들 수 없습니다.', 'The box is too heavy to carry.', 'too ... to 구조 사용', 'too ... to는 너무 ~해서 할 수 없다는 뜻입니다.', '정도 표현'],
    ['나는 근처에 사는 선생님을 압니다.', 'I know a teacher who lives nearby.', 'who 관계대명사 사용', '사람을 설명할 때 who를 사용할 수 있습니다.', '관계대명사'],
    ['이 가방은 저것보다 가볍습니다.', 'This bag is lighter than that one.', 'lighter than 비교급 사용', 'light의 비교급은 lighter입니다.', '비교급'],
    ['아파서 집에 있었습니다.', 'I stayed home because I was sick.', 'because 이유 연결', 'because절 하나로 이유를 연결할 수 있습니다.', '이유 연결'],
    ['저는 숙제를 끝냈습니다.', 'I have finished my homework.', 'have finished 사용', 'have + 과거분사 finished가 필요합니다.', '현재완료'],
    ['나는 우유를 사려고 가게에 갔습니다.', 'I went to the store to buy milk.', 'to buy 목적 표현', '목적은 to buy로 나타낼 수 있습니다.', '목적 표현'],
    ['방 안에는 사람이 많습니다.', 'There are many people in the room.', 'There are와 many people 사용', 'people은 복수 취급하므로 are와 many를 씁니다.', '수량 표현'],
    ['창문을 열어 주시겠어요?', 'Could you open the window?', 'Could you와 open 사용', 'Could you 뒤에는 동사원형을 씁니다.', '정중한 요청'],
    ['나는 내일 이모를 방문할 예정입니다.', 'I am going to visit my aunt tomorrow.', 'going to 미래 표현', 'be going to + 동사원형으로 예정된 미래를 말합니다.', '미래 표현'],
    ['나는 책 읽기를 즐깁니다.', 'I enjoy reading books.', 'enjoy reading 사용', 'enjoy 뒤에는 동명사 reading이 자연스럽습니다.', '동명사'],
    ['떠나기 전에 저에게 전화해 주세요.', 'Please call me before you leave.', 'before you leave 사용', 'before 뒤에는 주어+동사 구조를 쓸 수 있습니다.', '시간 접속사'],
    ['당신은 물을 더 마셔야 합니다.', 'You should drink more water.', 'should drink 사용', 'should 뒤에는 동사원형을 씁니다.', '조언 표현'],
    ['이 상자는 너무 무거워서 들 수 없습니다.', 'This box is too heavy to carry.', 'too heavy to carry 사용', 'too heavy to carry는 너무 무거워서 들 수 없다는 뜻입니다.', '정도 표현'],
    ['나는 근처에 사는 선생님을 알고 있습니다.', 'I know a teacher who lives nearby.', 'who lives nearby 사용', '사람을 설명할 때 who를 씁니다.', '관계대명사'],
  ],
  B1: [
    ['저에게 전화한 사람은 제 관리자입니다.', 'The person who called me is my manager.', 'who 관계절 사용', '사람을 설명할 때 who를 사용할 수 있습니다.', '관계절'],
    ['사무실이 어디에 있는지 알려 주실 수 있나요?', 'Can you tell me where the office is?', '간접의문문 어순 사용', '간접의문문은 주어와 동사의 평서문 어순을 씁니다.', '간접의문문'],
    ['비가 오면 행사를 실내로 옮길 것입니다.', 'If it rains, we will move the event indoors.', 'If 조건절과 will 사용', '조건문에서는 if절에 현재형을 씁니다.', '조건문'],
    ['문서들은 어제 발송되었습니다.', 'The documents were sent yesterday.', 'were sent 수동태 사용', '수동태는 be동사 + 과거분사입니다.', '수동태'],
    ['피곤해서 저는 일찍 잤습니다.', 'Feeling tired, I went to bed early.', 'Feeling tired 분사 표현', '상태의 이유를 분사구문으로 줄일 수 있습니다.', '분사 표현'],
    ['그 일이 어려웠지만 우리는 제시간에 끝냈습니다.', 'Although the task was difficult, we finished it on time.', 'Although 대조 연결', 'Although는 어려움과 반대되는 결과를 연결합니다.', '대조 연결'],
    ['모두가 이해할 수 있도록 그녀는 명확하게 말했습니다.', 'She spoke clearly so that everyone could understand.', 'so that 목적절 사용', 'so that은 목적을 나타냅니다.', '목적절'],
    ['그는 바쁘다고 말했습니다.', 'He said that he was busy.', 'said that과 was 사용', '과거 시점의 보고에서는 was를 쓸 수 있습니다.', '간접화법'],
    ['이 방법은 예전 것보다 더 효율적입니다.', 'This method is more efficient than the old one.', 'more efficient than 비교급', '긴 형용사는 more + 형용사 + than으로 비교합니다.', '비교급'],
    ['그 문제는 해결되었습니다.', 'The issue has been resolved.', 'has been resolved 수동태', '현재완료 수동태는 has been + 과거분사입니다.', '현재완료 수동태'],
    ['표가 없으면 들어갈 수 없습니다.', 'You cannot enter unless you have a ticket.', 'unless 조건 사용', 'unless는 ~하지 않는 한이라는 뜻입니다.', '조건 표현'],
    ['매일 연습하는 것은 실력 향상에 도움이 됩니다.', 'Practicing every day helps you improve.', '동명사 주어 Practicing 사용', '동명사가 문장의 주어로 올 수 있습니다.', '동명사 주어'],
    ['당신에게 전화한 사람은 제 관리자입니다.', 'The person who called you is my manager.', 'who 관계절 사용', '사람을 설명할 때 who를 쓰고 주어에 맞게 called를 씁니다.', '관계절'],
    ['사무실이 어디에 있는지 말해 줄 수 있나요?', 'Can you tell me where the office is?', 'where the office is 어순', '간접의문문은 where + 주어 + 동사 어순입니다.', '간접의문문'],
    ['비가 오면 우리는 행사를 실내로 옮길 것입니다.', 'If it rains, we will move the event indoors.', 'If it rains 조건문', '현재 조건에는 If + 현재, will + 동사원형을 씁니다.', '조건문'],
    ['그 문서들은 어제 발송되었습니다.', 'The documents were sent yesterday.', 'were sent 수동태', '수동태는 be동사 + 과거분사입니다.', '수동태'],
    ['피곤해서 일찍 잠자리에 들었습니다.', 'Feeling tired, I went to bed early.', 'Feeling tired 분사 표현', '주어가 느낀 상태를 Feeling tired로 줄일 수 있습니다.', '분사 표현'],
    ['과제가 어려웠지만 우리는 제시간에 끝냈습니다.', 'Although the task was difficult, we finished it on time.', 'Although 대조 연결', 'Although는 어려움과 반대되는 결과를 연결합니다.', '대조 연결'],
    ['그녀는 모두가 이해할 수 있도록 명확하게 말했습니다.', 'She spoke clearly so that everyone could understand.', 'so that 목적절', 'so that + 주어 + could는 목적을 나타냅니다.', '목적절'],
    ['그는 자신이 바쁘다고 말했습니다.', 'He said that he was busy.', 'said that 간접화법', '과거 보고에서는 시제를 맞춰 was를 씁니다.', '간접화법'],
    ['이 방법은 기존 방법보다 더 효율적입니다.', 'This method is more efficient than the old one.', 'more efficient than 비교', '긴 형용사는 more efficient than으로 비교합니다.', '비교급'],
    ['그 문제는 이미 해결되었습니다.', 'The issue has been resolved.', 'has been resolved 현재완료 수동태', '현재완료 수동태는 has been + 과거분사입니다.', '현재완료 수동태'],
    ['티켓이 없으면 입장할 수 없습니다.', 'You cannot enter unless you have a ticket.', 'unless 조건 표현', 'unless는 ~하지 않는 한이라는 조건입니다.', '조건 표현'],
    ['매일 연습하면 실력이 향상됩니다.', 'Practicing every day helps you improve.', '동명사 주어 Practicing', '동명사 Practicing이 문장의 주어로 쓰였습니다.', '동명사 주어'],
  ],
  B2: [
    ['그 정책은 일관되게 적용될 때에만 효과가 있을 것입니다.', 'The policy will work only if it is applied consistently.', 'only if 조건 강조', 'only if는 필요한 조건을 강하게 나타냅니다.', '조건 강조'],
    ['데이터를 검토한 후 우리는 권고안을 바꿨습니다.', 'Having reviewed the data, we changed our recommendation.', 'Having reviewed 완료 분사구문', '먼저 완료된 동작은 Having + 과거분사로 줄일 수 있습니다.', '완료 분사구문'],
    ['업데이트는 버그를 고쳤을 뿐만 아니라 속도도 개선했습니다.', 'Not only did the update fix bugs, but it also improved speed.', 'Not only 도치와 but also 사용', 'Not only가 앞에 오면 도치가 필요합니다.', '도치 구조'],
    ['우리가 더 일찍 테스트했다면 그 문제를 발견했을 것입니다.', 'If we had tested it earlier, we would have found the issue.', 'had tested와 would have found 사용', '과거 사실과 다른 가정은 가정법 과거완료를 씁니다.', '가정법 과거완료'],
    ['그 아이디어는 유망하지만 여전히 더 많은 증거가 필요합니다.', 'While the idea is promising, it still needs more evidence.', 'While 양보절과 still 사용', 'While은 인정과 한계를 함께 표현할 수 있습니다.', '양보와 한계'],
    ['서버에 저장된 파일들이 삭제되었습니다.', 'The files stored on the server were deleted.', 'stored on the server 축약 관계절', '과거분사구가 명사를 뒤에서 설명합니다.', '관계절 축약'],
    ['가장 중요한 것은 사용자가 그 시스템을 신뢰하는지입니다.', 'What matters most is whether users trust the system.', 'What 명사절 주어와 whether 사용', 'What matters most가 주어 역할을 합니다.', '명사절 주어'],
    ['불만에 대응하여 회사는 정책을 변경했습니다.', 'In response to the complaint, the company changed its policy.', 'In response to 전치사구', 'In response to는 ~에 대응하여라는 뜻입니다.', '전치사구'],
    ['실수를 일으킨 것은 불명확한 지시였습니다.', 'It was the unclear instructions that caused the mistake.', 'It was ... that 강조 구문', 'It was ... that으로 특정 원인을 강조할 수 있습니다.', '강조 구문'],
    ['그 결정은 새로운 증거를 고려하여 내려졌습니다.', 'The decision was made in light of the new evidence.', 'was made와 in light of 사용', 'in light of는 ~을 고려하여라는 뜻입니다.', '복합 전치사'],
    ['그 절차는 오류를 줄이기 위해 단순화되었습니다.', 'The process was simplified to reduce errors.', 'was simplified와 to reduce 사용', '수동태와 목적 표현을 함께 사용합니다.', '수동태와 목적'],
    ['그 도구는 유용하지만 신중한 설정이 필요합니다.', 'The tool is useful; however, it requires careful setup.', 'however 접속부사 사용', 'however는 앞뒤 내용을 대조합니다.', '접속부사'],
    ['그 정책은 일관되게 시행될 때에만 효과가 있을 것입니다.', 'The policy will work only if it is applied consistently.', 'only if 조건 강조', 'only if는 필요한 조건을 강조합니다.', '조건 강조'],
    ['데이터를 검토한 뒤 우리는 권고를 바꿨습니다.', 'Having reviewed the data, we changed our recommendation.', 'Having reviewed 사용', 'Having reviewed는 먼저 완료된 동작을 나타냅니다.', '완료 분사구문'],
    ['업데이트는 버그를 고쳤을 뿐 아니라 속도도 개선했습니다.', 'Not only did the update fix bugs, but it also improved speed.', 'Not only 도치 구조', 'Not only가 앞에 오면 did + 주어 + 동사원형 어순을 씁니다.', '도치 구조'],
    ['우리가 더 일찍 시험했다면 문제를 발견했을 것입니다.', 'If we had tested it earlier, we would have found the issue.', '가정법 과거완료 사용', '과거 사실과 다른 상황은 had + 과거분사와 would have를 씁니다.', '가정법 과거완료'],
    ['그 생각은 유망하지만 여전히 더 많은 증거가 필요합니다.', 'While the idea is promising, it still needs more evidence.', 'While 양보절 사용', 'While은 인정과 한계를 함께 말할 때 쓸 수 있습니다.', '양보와 한계'],
    ['서버에 저장된 파일들이 삭제됐습니다.', 'The files stored on the server were deleted.', 'stored on the server 사용', 'stored on the server는 files를 설명하는 과거분사구입니다.', '관계절 축약'],
    ['가장 중요한 것은 사용자가 시스템을 신뢰하는지 여부입니다.', 'What matters most is whether users trust the system.', 'What matters most 주어절', 'What matters most가 주어 역할을 합니다.', '명사절 주어'],
    ['불만에 대한 대응으로 회사는 정책을 바꿨습니다.', 'In response to the complaint, the company changed its policy.', 'In response to 사용', 'In response to는 ~에 대한 대응으로라는 뜻입니다.', '전치사구'],
    ['그 실수를 일으킨 것은 불명확한 지시였습니다.', 'It was the unclear instructions that caused the mistake.', 'It was ... that 강조', 'It was ... that 구조로 원인을 강조합니다.', '강조 구문'],
    ['그 결정은 새 증거를 고려하여 내려졌습니다.', 'The decision was made in light of the new evidence.', 'in light of 사용', 'in light of는 ~을 고려하여라는 뜻입니다.', '복합 전치사'],
    ['절차는 오류를 줄이기 위해 단순화되었습니다.', 'The process was simplified to reduce errors.', 'was simplified to reduce 사용', 'was simplified와 to reduce가 각각 수동과 목적을 나타냅니다.', '수동태와 목적'],
    ['그 도구는 유용하지만 신중한 설정이 필요합니다.', 'The tool is useful; however, it requires careful setup.', 'however 대조 사용', 'however는 앞뒤 절을 분명히 구분해서 씁니다.', '접속부사'],
  ],
};

function mapReadingTuple(tuple) {
  const [en, ko, focus, weak] = tuple;
  return { en, ko, focus, weak };
}

function mapTargetTuple(tuple) {
  const [promptKo, context, ko, sample, explanationKo, weak] = tuple;
  return {
    promptKo,
    context,
    ko,
    sample,
    focus: `${weak} 표현을 정확하고 자연스럽게 사용했는지 평가합니다.`,
    explanationKo,
    weak,
  };
}

function mapGrammarTuple(tuple) {
  const [ko, sample, focus, explanationKo, weak] = tuple;
  return { ko, sample, focus, explanationKo, weak };
}

const questions = [];

for (const level of levels) {
  const reading = readingItems[level].map(mapReadingTuple);
  const conversation = conversationTargets[level].map(mapTargetTuple);
  const grammar = grammarTargets[level].map(mapGrammarTuple);

  if (reading.length !== 32 || conversation.length !== 24 || grammar.length !== 24) {
    throw new Error(`${level} source counts must be reading 32, conversation 24, grammar 24.`);
  }

  reading.slice(0, 16).forEach((item, index) => {
    questions.push(makeChoiceQuestion({
      level,
      area: 'reading',
      group: 'reading-choice',
      index,
      promptKo: '영어 문장을 읽고 의미가 맞는 것을 고르세요.',
      questionText: item.en,
      choices: [item.ko, rotateChoice(reading, index, 1), rotateChoice(reading, index, 2)],
      explanationKo: `${item.focus}을 이해해야 합니다.`,
      weakPointLabel: item.weak,
    }));
  });

  reading.slice(16).forEach((item, index) => {
    questions.push(makeTranslationQuestion(level, index, item));
  });

  conversation.slice(0, 12).forEach((target, index) => {
    questions.push(makeExpressionChoice(level, 'conversation-choice', index, target));
  });

  conversation.slice(12).forEach((target, index) => {
    questions.push(makeEnglishWritingQuestion(level, 'conversation', 'conversation-writing', index, target));
  });

  grammar.slice(0, 12).forEach((target, index) => {
    questions.push(makeGrammarChoice(level, index, target));
  });

  grammar.slice(12).forEach((target, index) => {
    questions.push(makeEnglishWritingQuestion(level, 'grammar', 'grammar-writing', index, target));
  });

  const levelCount = questions.filter((question) => question.level === level).length;
  if (levelCount !== 80) {
    throw new Error(`${level} generated ${levelCount}, expected 80.`);
  }
}

writeFileSync(
  outputPath,
  `import type { LearningQuestion } from '../types/learning';\n\nexport const generatedDoubleQuestions: LearningQuestion[] = ${JSON.stringify(questions, null, 2)};\n`,
  'utf8',
);

console.log(`Generated ${questions.length} additional questions at ${outputPath}`);

export const READING_PRACTICE = {
  id: 'urban-trees',
  title: 'Urban trees and cooler streets',
  passage: `Cities are often warmer than the countryside around them. Roads and buildings absorb heat during the day and release it slowly after sunset. This pattern, known as the urban heat-island effect, can make heatwaves more dangerous, particularly for people who are elderly, work outdoors, or live in homes without effective cooling.

Trees can reduce some of this heat in two ways. Their leaves shade walls and pavements, while water released from leaves cools the surrounding air. A study in three neighbourhoods found that shaded streets were cooler in the afternoon than streets with little tree cover. However, the researchers warned that the result should not be treated as a universal figure: tree species, local weather, street design and the age of the trees all affected the measurements.

Planting trees is not an instant solution. Young trees provide less shade than mature ones, and some do not survive their first summers. In one city programme, survival was higher where residents helped choose planting locations and reported damage. The city also found that watering during the first two summers was more important than adding extra trees to streets where young trees had already died.

Tree planting can create problems if it is poorly planned. Roots may damage pavements, branches can interfere with overhead cables, and pollen can affect people with allergies. In dry regions, unsuitable trees may consume scarce water. Planners therefore recommend choosing species suited to local conditions and considering underground services before planting.

Researchers also point out that tree cover is often unevenly distributed. Wealthier districts may have older parks and more shaded streets, while densely populated areas can have fewer places to escape the heat. A fair programme should prioritise residents with the greatest exposure and consult them about the locations they use. Trees are not a substitute for public cooling centres, reliable health services or reducing emissions, but they can form one part of a broader heat-protection plan.`,
  questions: [
    { id: 'r1', type: 'tfng', prompt: 'The urban heat-island effect can continue after the sun has set.', answer: 0, explanation: 'The passage says roads and buildings release stored heat slowly after sunset.' },
    { id: 'r2', type: 'tfng', prompt: 'The study found the same cooling effect in every city where trees were measured.', answer: 2, explanation: 'It describes three neighbourhoods and explicitly warns that the result is not universal; it gives no result for every city.' },
    { id: 'r3', type: 'tfng', prompt: 'Residents who helped choose planting locations had a higher tree survival rate in one programme.', answer: 0, explanation: 'The city programme reported higher survival where residents helped choose locations and report damage.' },
    { id: 'r4', type: 'tfng', prompt: 'The city concluded that planting more trees was always more useful than watering young trees.', answer: 1, explanation: 'The passage says watering young trees in their first two summers mattered more than adding trees where young ones had died.' },
    { id: 'r5', type: 'tfng', prompt: 'The passage says all tree species need the same amount of water.', answer: 2, explanation: 'It warns that unsuitable trees may use scarce water but does not compare the water needs of all species.' },
    { id: 'r6', type: 'mcq', prompt: 'According to the passage, which two processes help trees cool streets?', options: ['Blocking wind and absorbing rain', 'Providing shade and releasing water from leaves', 'Reflecting sunlight and warming pavements', 'Reducing traffic and cleaning the air'], answer: 1, explanation: 'The text identifies shade and water released from leaves.' },
    { id: 'r7', type: 'mcq', prompt: 'Why does the passage recommend consulting residents?', options: ['They can replace city maintenance teams', 'They know where people experience heat and use public spaces', 'They can choose trees without technical advice', 'They can guarantee that no trees will die'], answer: 1, explanation: 'Consultation helps target areas with high exposure and locations people actually use.' },
    { id: 'r8', type: 'mcq', prompt: 'Which risk is specifically associated with dry regions?', options: ['Overhead cables becoming colder', 'Trees using limited water supplies', 'More pollen being produced by every species', 'Young trees growing too quickly'], answer: 1, explanation: 'The passage warns that unsuitable trees may consume scarce water in dry regions.' },
    { id: 'r9', type: 'mcq', prompt: 'What is the writer’s main conclusion about urban trees?', options: ['They can solve the urban heat problem by themselves', 'They are useful as one element of a wider heat-protection strategy', 'They should be planted only in wealthy districts', 'They are less useful than air conditioning in every situation'], answer: 1, explanation: 'The final paragraph says trees can be one part of a broader plan, not a substitute for other measures.' },
    { id: 'r10', type: 'mcq', prompt: 'Which factor does NOT appear in the passage as affecting measured cooling?', options: ['Tree species', 'Street design', 'The age of trees', 'The colour of residents’ homes'], answer: 3, explanation: 'The first study mentions species, weather, street design and tree age; home colour is not mentioned.' }
  ]
};

export const LISTENING_PRACTICE = {
  id: 'community-library',
  title: 'A new community library',
  script: `Hello everyone, and thank you for coming to the planning meeting for the new community library. The building will be on Market Street, opposite the bus station. We originally considered the old post office, but it does not have enough room for the study area.

The library will open on the eighteenth of September. During the first week, it will be open from ten in the morning until six in the evening. After that, the usual weekday hours will be nine until eight. On Saturdays, we will close at four, and the library will not open on Sundays.

There will be three main areas. The quiet study room is upstairs and has twenty-four desks. The children's corner is on the ground floor next to the garden. The computer room is beside the reception desk; visitors can book a computer for up to one hour at a time.

Membership is free, but please bring proof of your address when you register. Members can borrow up to six books for three weeks. If you need a book for longer, you can renew it online, unless another reader has reserved it.

Finally, our first public event will be a talk about local history on the twenty-second of September at half past six in the evening. You can reserve a seat at the front desk or on our website. We hope to see you there.`,
  questions: [
    { id: 'l1', prompt: 'Where will the library be located?', options: ['In the old post office', 'On Market Street opposite the bus station', 'Inside the bus station', 'Next to the town hall'], answer: 1, explanation: 'The speaker says it will be on Market Street, opposite the bus station.' },
    { id: 'l2', prompt: 'Why was the old post office rejected?', options: ['It was too far from the bus station', 'It was too expensive to repair', 'There was not enough space for the study area', 'It could not open on Saturdays'], answer: 2, explanation: 'The old post office did not have enough room for the study area.' },
    { id: 'l3', prompt: 'What time will the library close during its first week?', options: ['4 p.m.', '6 p.m.', '8 p.m.', '9 p.m.'], answer: 1, explanation: 'For the first week, opening hours are ten until six.' },
    { id: 'l4', prompt: 'How many desks are in the quiet study room?', options: ['14', '20', '24', '40'], answer: 2, explanation: 'The quiet study room upstairs has twenty-four desks.' },
    { id: 'l5', prompt: 'Where is the children’s area?', options: ['Upstairs near the study room', 'On the ground floor beside the garden', 'Next to the computer room', 'Behind the reception desk'], answer: 1, explanation: 'The children’s corner is on the ground floor next to the garden.' },
    { id: 'l6', prompt: 'What must a new member bring?', options: ['A photograph', 'A school certificate', 'Proof of address', 'A payment receipt'], answer: 2, explanation: 'Registration requires proof of address.' },
    { id: 'l7', prompt: 'How long may a member borrow a book before renewing it?', options: ['One week', 'Two weeks', 'Three weeks', 'Six weeks'], answer: 2, explanation: 'Members may borrow books for three weeks.' },
    { id: 'l8', prompt: 'When is the first public event?', options: ['18 September at 6:30 p.m.', '22 September at 4 p.m.', '22 September at 6:30 p.m.', 'The first Saturday at 9 a.m.'], answer: 2, explanation: 'The local history talk is on 22 September at half past six in the evening.' }
  ]
};

export function scoreReading(answers) {
  return scoreQuestions(READING_PRACTICE.questions, answers);
}

export function scoreListening(answers) {
  return scoreQuestions(LISTENING_PRACTICE.questions, answers);
}

function scoreQuestions(questions, answers) {
  const details = questions.map(question => {
    const selected = answers[question.id];
    const correct = selected === question.answer;
    return { id: question.id, selected: selected ?? null, correct, explanation: question.explanation };
  });
  const correct = details.filter(result => result.correct).length;
  return { correct, total: questions.length, details, percentage: Math.round(correct / questions.length * 100) };
}

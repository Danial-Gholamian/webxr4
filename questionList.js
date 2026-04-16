export const QUESTIONS = [
    {
        question: "1. Adjust the temporal window to approximately match the width of a histogram bar (≈100 units). Which interval shows the highest interaction activity, and which three groups are the most active?",
        answers: [
            "Interval A — Groups 1B, 3B, 5B",
            "Interval B — Groups 4B, Teachers, 5A",
            "Interval C — Groups 1B, 2B, 3A", // Correct Answer
            "Interval D - Groups 5B, 2A, 1B"

        ]
    },
    {
        question: "2. Reset the graph and filter for the teacher group. Locate node ID 1653 and observe its interactions over time. Throughout the whole dataset (Day and Day2), which student group does this teacher interact with the most?",
        answers: [
            "Group 4A", // Correct Answer
            "Group 5A", //
            "Group 2B",
            "Group 1B"
        ]
    },
    {
        question: "3. One of the days, some groups left earlier than others based on their interaction patterns. Which groups left earlier, and on which day does this occur?",
        answers: [
            "Groups 4A & 4B — Day 1", // Correct Answer
            "Groups 4A & 4B — Day 2",
            "Groups 5B & 4A — Day 1",
            "Groups 5B & 4A — Day 2",
        ]
    },
    {
        question: "4. Reset the graph and set the interaction filter to inter-group. Reduce the temporal window to a single timestamp and explore the timeline. During which interval does interaction between teachers and students drop significantly (indicating lunch break)?",
        answers: [
            "Interval 600 - 900", // Correct Answer
            "Interval 4000 - 4300", // Correct Answer
            "Both intervals",
            "No clear interval"
        ]
    }
];
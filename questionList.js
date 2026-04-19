export const QUESTIONS = [
        {
        question: "Set the temporal window size to approximately 150 units and move it to the interval [4300–4450]. Set the interaction mode to Inter-group. Which group has the highest number of interactions in this interval?",
        answers: [
            "Teachers", // Correct
            "Group 1B",
            "Group 4A",
            "Group 5B"
        ]
    },
    {
        question: "Reset the graph. Expand the temporal window to cover the entire Day 2. Filter the graph to Group 4A and locate node 1546. Set the interaction mode to Intra-group. How many interactions does this node have with its group?",
        answers: [
            "16", // Correct
            "12",
            "20",
            "8"
        ]
    },
    {
        question: "Reduce the temporal window size to a single timestamp and move it to the interval [1554–1556]. How many active nodes are visible in the graph?",
        answers: [
            "22", // Correct
            "18",
            "25",
            "30"
        ]
    },
    {
        question: "Adjust the temporal window to approximately match the width of a histogram bar (≈100 units). Which interval shows the highest interaction activity, and which three groups are the most active?",
        answers: [
            "Groups 1B, 3B, 4B", // Correct Answer
            "Groups 4B, Teachers, 5A",
            "Groups 1B, 2B, 3A", 
            "Groups 5B, 2A, 1B"

        ]
    },
    {
        question: "Reset the graph and filter for the teacher group. Locate node ID 1653 and observe its interactions over time. Throughout the whole dataset (Day and Day2), which student group does this teacher interact with the most?",
        answers: [
            "Group 4A", // Correct Answer
            "Group 5A", //
            "Group 2B",
            "Group 1B"
        ]
    },
    {
        question: "One of the days, some groups left earlier than others based on their interaction patterns. Which groups left earlier, and on which day does this occur?",
        answers: [
            "Groups 4A & 4B — Day 1", // Correct Answer
            "Groups 4A & 4B — Day 2",
            "Groups 5B & 4A — Day 1",
            "Groups 5B & 4A — Day 2",
        ]
    },
    {
        question: "Reset the graph and set the interaction filter to inter-group. Reduce the temporal window to a single timestamp and explore the timeline. During which interval does interaction between teachers and students drop significantly (indicating lunch break)?",
        answers: [
            "Interval 600 - 900",
            "Interval 5000 - 5300",
            "Both intervals", // Correct Answer
            "No clear interval"
        ]
    },

    {
        question: "Compare the following two time intervals: Interval A (600–900) and Interval B (5000–5300). Which interval shows higher interaction activity?",
        answers: [
            "Interval A",
            "Interval B",
            "Both intervals show similar activity",
            "Cannot determine"
        ]
    }
];
import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';

export const defaultAnswers: TaskLibAnswers = <TaskLibAnswers>{
    "find": {
        "/someDir": [
            "someDir/someFile2",
            "/someDir/someFile1"
        ]
    },
    "match": {
        "/some/*pattern": [
            "some/path/one",
            "some/path/two"
        ],
        "/invalid/*pattern": []
    }
};
import os
import json

codeowners_file_path = '/workspaces/azure-pipelines-tasks/.github/CODEOWNERS'
team_name = '@microsoft/azure-artifacts-packages'

def extract_tasks_owned_by_team(file_path, team):
    tasks = []
    with open(file_path, 'r') as file:
        for line in file:
            if team in line:
                task_path = line.split()[0]
                tasks.append(task_path)
    return tasks

def extract_task_id(task_path):
    task_json_path = os.path.join(task_path, 'task.json')
    if os.path.exists(task_json_path):
        with open(task_json_path, 'r') as file:
            task_data = json.load(file)
            return task_data.get('id')
    return None

# Specify the path to the CODEOWNERS file and the team name


# Extract tasks owned by the specified team
tasks_owned_by_team = extract_tasks_owned_by_team(codeowners_file_path, team_name)

# Extract and print the task IDs for each task
for task in tasks_owned_by_team:
    task_id = extract_task_id(task)
    if task_id:
        print(f'Task Path: {task}, Task ID: {task_id}')
    else:
        print(f'Task Path: {task}, Task ID: Not Found')    
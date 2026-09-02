grammar ProjectDSL

entry Project:
    'project'
    name=ID
    '{'
        metadata=Metadata?
        members+=Member*
        modules+=Module+
        tasks+=Task*
    '}'
;

Metadata:
    'metadata'
    '{'
        version=INT
        visibility=('public' | 'private')
    '}'
;

Member:
    'member'
    name=ID
    role=('manager' | 'developer' | 'tester' | 'designer')
;

Module:
    'module'
    name=ID
    type=('frontend' | 'backend' | 'database' | 'shared')
    '{'
        components+=Component*
    '}'
;

Component:
    'component'
    name=ID
    language=('java' | 'typescript' | 'python' | 'cpp')
    lines=INT
;

Task:
    'task'
    title=ID
    priority=('low' | 'medium' | 'high')
    status=('todo' | 'doing' | 'done')
    assignee=Member?
    module=Module?
    estimate=INT
    '{'
        subtasks+=SubTask*
    '}'
;

SubTask:
    'subtask'
    title=ID
    completed=('yes' | 'no')
;

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal INT returns number: /[0-9]+/;
terminal WS hidden: /\s+/;
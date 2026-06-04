# Probably Paradoxical — ER Diagram

Standalone entity–relationship diagram for the data model in [`DB_DESIGN.md`](./DB_DESIGN.md).
Renders natively on GitHub (Mermaid). Crow's-foot notation: `||` = one, `o{` = zero-or-many, `o|` = zero-or-one.

```mermaid
erDiagram
    ADMINS {
        ObjectId _id PK
        string   email UK
        string   username UK
        string   passwordHash
        string   role
        bool     isActive
        date     lastLoginAt
    }
    JUDGES {
        ObjectId _id PK
        string   email UK
        string   name
        string   affiliation
        string   expertise
        string   passwordHash
        number   defaultWeight
        bool     isActive
    }
    TEAMS {
        ObjectId _id PK
        string   teamId UK
        string   teamName
        ObjectId iconFileId FK
        ObjectId leadMemberId FK
        string   status
        string   currentRoundKey
        object   progress
    }
    MEMBERS {
        ObjectId _id PK
        string   email UK
        string   name
        string   phone
        string   affiliation
    }
    TEAM_MEMBERS {
        ObjectId _id PK
        string   teamId FK
        ObjectId memberId FK
        string   roleInTeam
        string   tag
        string   status
        date     joinedAt
    }
    TEAM_CREDENTIALS {
        ObjectId _id PK
        string   teamId FK,UK
        string   passwordHash
        date     lastUsedAt
    }
    CONFIG {
        string   _id PK
        string   competitionName
        string   currentRoundKey
        object   teamSize
        object   targetPopulations
        object   scoringDefaults
    }
    ROUNDS {
        ObjectId _id PK
        string   roundKey UK
        number   order
        string   title
        date     opensAt
        date     closesAt
        string   state
        string   submissionType
        bool     requiresJudging
        string   rubricKey FK
        object   scoring
    }
    PARADOXES {
        ObjectId _id PK
        string   paradoxCode UK
        string   title
        string   statement
        string   category
        string   state
        date     publishedAt
    }
    RUBRICS {
        ObjectId _id PK
        string   rubricKey
        number   version
        string   appliesTo
        object   criteria
        bool     isActive
    }
    SUBMISSIONS {
        ObjectId _id PK
        string   teamId FK
        string   roundKey FK
        string   type
        string   status
        string   paradoxCode FK
        string   theme
        string   targetPopulation
        ObjectId questionnaireId FK
        object   fileIds
        ObjectId submittedByMemberId FK
        date     submittedAt
        ObjectId reviewedBy FK
    }
    QUESTIONNAIRES {
        ObjectId _id PK
        string   teamId FK
        string   paradoxCode FK
        string   theme
        string   targetPopulation
        string   status
        object   items
        date     lockedAt
    }
    FILES {
        ObjectId _id PK
        string   r2Key UK
        string   kind
        string   originalName
        string   contentType
        string   extension
        number   sizeBytes
        ObjectId submissionId FK
        string   teamId FK
        string   roundKey FK
        ObjectId uploadedByMemberId FK
    }
    ASSIGNMENTS {
        ObjectId _id PK
        ObjectId questionnaireId FK
        ObjectId judgeId FK
        string   teamId FK
        number   weight
        string   status
        ObjectId assignedBy FK
        date     dueAt
    }
    EVALUATIONS {
        ObjectId _id PK
        ObjectId questionnaireId FK
        ObjectId judgeId FK
        string   teamId FK
        string   rubricKey FK
        number   rubricVersion
        object   itemScores
        object   criterionScores
        number   rawTotal
        string   recommendation
        string   status
    }
    RESULTS {
        ObjectId _id PK
        string   roundKey FK
        string   teamId FK
        string   outcome
        number   aggregateScore
        number   rank
        object   breakdown
        ObjectId publishedBy FK
        date     publishedAt
    }
    AUDIT_EVENTS {
        ObjectId _id PK
        string   actorRole
        string   actorId
        string   action
        string   targetType
        string   targetId
        object   before
        object   after
        date     at
    }

    TEAMS              ||--o{  TEAM_MEMBERS     : "has roster"
    MEMBERS            ||--o{  TEAM_MEMBERS     : "enrolled via"
    MEMBERS            ||--o|  TEAMS            : "leads"
    TEAMS              ||--||  TEAM_CREDENTIALS : "secured by"
    TEAMS              ||--o|  FILES            : "branded by (icon)"
    TEAMS              ||--o{  SUBMISSIONS      : submits
    ROUNDS             ||--o{  SUBMISSIONS      : gates
    PARADOXES          ||--o{  SUBMISSIONS      : "chosen in"
    TEAMS              ||--o|  QUESTIONNAIRES   : builds
    PARADOXES          ||--o{  QUESTIONNAIRES   : "based on"
    SUBMISSIONS        ||--o|  QUESTIONNAIRES   : references
    SUBMISSIONS        ||--o{  FILES            : "has artifact"
    MEMBERS            ||--o{  SUBMISSIONS      : "submitted by"
    QUESTIONNAIRES     ||--o{  ASSIGNMENTS      : "reviewed via"
    JUDGES             ||--o{  ASSIGNMENTS      : "assigned to"
    QUESTIONNAIRES     ||--o{  EVALUATIONS      : "scored in"
    JUDGES             ||--o{  EVALUATIONS      : authors
    RUBRICS            ||--o{  EVALUATIONS      : "applied in"
    ROUNDS             ||--o{  RUBRICS          : uses
    ROUNDS             ||--o{  RESULTS          : "published as"
    TEAMS              ||--o{  RESULTS          : "ranked in"
    CONFIG             ||--o|  ROUNDS           : "active round"
    ADMINS             ||--o{  SUBMISSIONS      : reviews
    ADMINS             ||--o{  ASSIGNMENTS      : creates
    ADMINS             ||--o{  RESULTS          : publishes
```

## Legend

| Symbol | Meaning |
|--------|---------|
| `PK` | Primary key (`_id`, or stable code) |
| `FK` | Foreign reference (by `ObjectId` or stable code such as `teamId`, `paradoxCode`, `roundKey`) |
| `UK` | Unique key / unique index |
| `\|\|` | exactly one |
| `o{` | zero or many |
| `o\|` | zero or one |

## Reading the flow

1. **Setup** — host seeds `CONFIG`, `ROUNDS`, `PARADOXES`, `RUBRICS`; registers `TEAMS` (+ `TEAM_CREDENTIALS` + optional `team_icon` in R2) and `JUDGES`. People live in `MEMBERS`; the `TEAM_MEMBERS` mapper links each member to a team with a role.
2. **Stage 1** — each team creates one `SUBMISSIONS(type=theme)` referencing a `PARADOXES` choice + one `QUESTIONNAIRES`.
3. **Judging** — host creates `ASSIGNMENTS` (judge subsets); judges author `EVALUATIONS` against a `RUBRICS`.
4. **Gate** — host aggregates and writes `RESULTS` per round; `TEAMS.progress` is updated.
5. **Data & analysis** — teams add `SUBMISSIONS(type=dataset|analysis_zip)` with `FILES` in R2 (CSV/Excel, then ZIP).
6. **Throughout** — every state change is appended to `AUDIT_EVENTS`.

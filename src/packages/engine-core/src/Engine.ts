import { getLogs } from '@prisma/debug'
import stripAnsi from 'strip-ansi'
import {
  isRustError,
  //  PanicLogFields,
  RustError,
  RustLog,
} from './log'
import { NodeEngine } from './NodeEngine'
import { getGithubIssueUrl, link } from './util'

export function getMessage(log: string | RustLog | RustError | any): string {
  if (typeof log === 'string') {
    return log
  } else if (isRustError(log)) {
    return log.message
  } else if (log.fields && log.fields.message) {
    if (log.fields.reason) {
      return `${log.fields.message}: ${log.fields.reason}`
    }
    return log.fields.message
  } else {
    return JSON.stringify(log)
  }
}

export interface RequestError {
  error: string
  user_facing_error: {
    is_panic: boolean
    message: string
    meta?: object
    error_code?: string
  }
}

export class PrismaClientKnownRequestError extends Error {
  code: string
  meta?: object
  clientVersion: string

  constructor(
    message: string,
    code: string,
    clientVersion: string,
    meta?: any,
  ) {
    super(message)

    this.code = code
    this.clientVersion = clientVersion
    this.meta = meta
  }
}

export class PrismaClientUnknownRequestError extends Error {
  clientVersion: string

  constructor(message: string, clientVersion: string) {
    super(message)

    this.clientVersion = clientVersion
  }
}

export class PrismaClientRustPanicError extends Error {
  clientVersion: string

  constructor(message: string, clientVersion: string) {
    super(message)

    this.clientVersion = clientVersion
  }
}

export class PrismaClientInitializationError extends Error {
  clientVersion: string

  constructor(message: string, clientVersion: string) {
    super(message)

    this.clientVersion = clientVersion
  }
}

export interface ErrorWithLinkInput {
  title: string
  description?: string
}
interface IssueTemplateOptions {
  os: string
  database: string
  nodeVersion: string
  clientVersion: string
  engineVersion: string

  logs: string
}
function clientBugIssueTemplate({
  os,
  database,
  nodeVersion,
  clientVersion,
  engineVersion,
  logs,
}: IssueTemplateOptions): string {
  return stripAnsi(`
<!-- 
Thanks for helping us improve Prisma! 🙏 Please follow the sections in the template and provide as much information as possible about your problem, e.g. by setting the \`DEBUG="*"\` environment variable and enabling additional logging output in Prisma Client.

Learn more about writing proper bug reports here: https://pris.ly/d/bug-reports
-->

## Bug description

<!-- A clear and concise description of what the bug is. -->

## How to reproduce

<!--
Steps to reproduce the behavior:
1. Go to '...'
2. Change '....'
3. Run '....'
4. See error
-->

## Expected behavior

<!-- A clear and concise description of what you expected to happen. -->

## Prisma information

<!-- Your Prisma schema, Prisma Client queries, ...
Do not include your database credentials when sharing your Prisma schema! -->

## Environment & setup

<!-- In which environment does the problem occur -->

- OS: ${os}<!--[e.g. Mac OS, Windows, Debian, CentOS, ...]-->
- Database: ${database}<!--[PostgreSQL, MySQL, MariaDB or SQLite]-->
- Node.js version: ${nodeVersion}<!--[Run \`node -v\` to see your Node.js version]-->
- Client version: ${clientVersion}
- Engine version: ${engineVersion}
<!--[Run \`prisma -v\` to see your Prisma version and paste it between the \´\´\´]-->
\`\`\`

\`\`\`
## Logs
<details>
  <summary>Click to expand!</summary>
  
  \`\`\`
  ${logs}
  \`\`\`
</details>
  `)
}
export async function getErrorMessageWithLink(
  engine: NodeEngine,
  options?: ErrorWithLinkInput,
) {
  const logs = normalizeLogs(stripAnsi(getLogs()))
  const moreInfo = options?.description
  ? `# Description\n\`\`\`\n${options.description}\n\`\`\``
  : ''
  const engineVersion = await engine.version()
  const content = clientBugIssueTemplate({
    database: engine.datasources.map((datasource) => datasource.name).join(', '),
    logs: logs,
    nodeVersion: process.version,
    os: engine.platform,
    clientVersion: engine.clientVersion,
    engineVersion: engineVersion
  })



  const url = getGithubIssueUrl({ title: options?.title, body: content })
  if (url.length >= 2048) {
    console.log('F');
  }
  return `${options?.title}

This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

${link(url)}

If you want the Prisma team to look into it, please open the link above 🙏
`
}
function saveError(content: string) {}

/**
 * Removes the leading timestamps (from docker) and trailing ms (from debug)
 * @param logs logs to normalize
 */
function normalizeLogs(logs: string): string {
  return logs
    .split('\n')
    .map((l) => {
      return l
        .replace(
          /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)\s*/,
          '',
        )
        .replace(/\+\d+\s*ms$/, '')
    })
    .join('\n')
}

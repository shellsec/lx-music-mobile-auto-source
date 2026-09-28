/** 内置自定义音源清单（启动写入，失败时按序切换 musicUrl） */
import * as flower from './flower'
import * as sixyin from './sixyin'
import * as huibq from './huibq'
import * as ikun from './ikun'
import * as grass from './grass'
import * as juhe from './juhe'
import * as qdy from './qdy'

export const USER_API_AUTO_ID = 'user_api_auto'

export interface BuiltinUserApi {
  key: string
  id: string
  name: string
  author: string
  version: string
  script: string
}

export const BUILTIN_USER_APIS: BuiltinUserApi[] = [
  { key: 'flower', id: flower.id, name: flower.name, author: flower.author, version: flower.version, script: flower.script },
  { key: 'sixyin', id: sixyin.id, name: sixyin.name, author: sixyin.author, version: sixyin.version, script: sixyin.script },
  { key: 'huibq', id: huibq.id, name: huibq.name, author: huibq.author, version: huibq.version, script: huibq.script },
  { key: 'ikun', id: ikun.id, name: ikun.name, author: ikun.author, version: ikun.version, script: ikun.script },
  { key: 'grass', id: grass.id, name: grass.name, author: grass.author, version: grass.version, script: grass.script },
  { key: 'juhe', id: juhe.id, name: juhe.name, author: juhe.author, version: juhe.version, script: juhe.script },
  { key: 'qdy', id: qdy.id, name: qdy.name, author: qdy.author, version: qdy.version, script: qdy.script },
]

export const BUILTIN_USER_API_IDS = BUILTIN_USER_APIS.map((a) => a.id)

export const getBuiltinScript = (id: string) => BUILTIN_USER_APIS.find((a) => a.id === id)?.script ?? ''

export const isBuiltinUserApiId = (id: string) => id === USER_API_AUTO_ID || BUILTIN_USER_API_IDS.includes(id)

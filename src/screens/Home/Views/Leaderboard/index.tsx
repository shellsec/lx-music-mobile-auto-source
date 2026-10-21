import { useHorizontalMode } from '@/utils/hooks'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
// import { AppColors } from '@/theme'

import { useUserApiList } from '@/store/userApi'
import Text from '@/components/common/Text'

const SourceContent = () => {
  const isHorizontalMode = useHorizontalMode()

  return isHorizontalMode
    ? <Horizontal />
    : <Vertical />
}

export default () => {
  const sources = useUserApiList()
  return sources.length ? <SourceContent /> : <Text>请在设置中导入自定义源</Text>
}

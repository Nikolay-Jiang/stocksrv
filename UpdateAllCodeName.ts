import { UpdateAllCodeName, prisma } from './dbBll'
import logger from './logger';

// const dataurl = "https://qt.gtimg.cn/q=sz002415";

async function main() {

await  UpdateAllCodeName();

}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

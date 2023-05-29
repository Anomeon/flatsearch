import { chromium } from 'playwright-extra';
import { PrismaClient } from '@prisma/client';
import stealth from 'puppeteer-extra-plugin-stealth';
import { MarkersResponse } from 'types/MarkersType';
import { USER_AGENT, TOTAL_RESULTS_MAX_VALUE } from 'utils/constants';
import { logger } from 'utils/logger';
import * as TR from 'utils/tr-texts';
import { APP_ENV } from 'utils/app-env';

// Setup
chromium.use(stealth());
const prisma = new PrismaClient();

// Main Function
async function main() {
  try {
    await getData();
    await prisma.$disconnect();
  } catch (error) {
    logger.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}
main();


async function getData() {
  // Setup browser
  const browser = await chromium.launch({
    headless: APP_ENV.IS_HEADLESS,
    args: [
      '--start-maximized',
    ]
  });
  // 'viewport: null' to disable shrinking after maximizing on start
  const context = await browser.newContext({ viewport: null, userAgent: USER_AGENT });
  const page = await context.newPage();

  // Setup variables
  function* getLinksGenerator() {
    yield 'https://www.sahibinden.com/haritada-emlak-arama/kiralik/mugla-fethiye-fethiye?a103713=true&autoViewport=3&query_text_mf=fethiye';
    return 'https://www.sahibinden.com/haritada-emlak-arama/kiralik/mugla-fethiye-oludeniz-oludeniz-mh.?a103713=true&autoViewport=3&query_text_mf=fethiye';
  };
  const markersResponses: MarkersResponse[] = [];
  const linksGenerator = getLinksGenerator();
  let link = linksGenerator.next();

  // Add responses listener before go to the page
  page.on('response', async (res) => {
    if (!res.request().url().includes('mapSearch/classified/markers')) return;

    try {
      const data: MarkersResponse = await res.json();
      markersResponses.push(data);
      if (!link.done) {
        link = linksGenerator.next();
        await page.goto(link.value);
      } else {
        await saveData(markersResponses);
      }
    } catch (err) {
      logger.error("Response wasn't JSON or failed to parse response.");
    }
  });

  // Visit page logic
  await page.goto(link.value);

  // Trying to bypass captcha
  const hasCaptcha = await page.getByText(TR.WE_CHECK_YOUR_BROWSER_TEXT).count() > 0;
  if (hasCaptcha) {
    const box = await page.locator('#btn-continue').boundingBox();
    if (box !== null) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
}

async function saveData(markersResponses: MarkersResponse[]) {
  try {
    // Use transaction to rollback ALL data on any error with saving
    await prisma.$transaction(async () => {
      for await (const data of markersResponses) {
        if (data.paging.totalResults > TOTAL_RESULTS_MAX_VALUE) {
          // Should I use object Error?
          throw `Count of data overflowed limit: ${data.paging.totalResults}/${TOTAL_RESULTS_MAX_VALUE}`;
        }

        const rawData = await prisma.rawData.create({
          data: {
            payload: data,
          }
        });

        for await (const marker of data.classifiedMarkers) {
          const location = await prisma.location.upsert({
            where: { name: marker.location },
            update: {},
            create: {
              name: marker.location,
            }
          });

          const markerId = parseInt(marker.id, 10);
          const flat = await prisma.flat.upsert({
            where: { externalId: markerId },
            update: {},
            create: {
              externalId: markerId,
              locationId: location.id,
            }
          });

          await prisma.snapshot.create({
            data: {
              price: marker.price,
              flatId: flat.id,
              rawDataId: rawData.id,
              lat: String(marker.lat),
              lon: String(marker.lon),
              area: marker.attributes[TR.AREA_FIELD],
              size: marker.attributes[TR.SIZE_FIELD],
              floor: marker.attributes[TR.FLOOR_FIELD],
              title: marker.title,
              url: marker.url,
              thumbnailUrl: marker.thumbnailUrl,
            }
          });
        }
        logger.info(`Data in link saved. RawDataId: ${rawData.id}. Response contained ${data.paging.totalResults}/${TOTAL_RESULTS_MAX_VALUE} records`);
      }
    });
    logger.info('All data saved');
    // Should it be inside this function? It's suitable, in case to not forget to exit from process..
    process.exit();
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}

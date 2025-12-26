/**
 * KB Seed Command
 * Seeds the knowledge base with initial FAQ entries and docs
 */

import { Injectable, Logger } from '@nestjs/common';
import { KbIngestService } from './services/kb-ingest.service';
import { FAQ_SEEDS } from './data/faq-seeds';
import * as path from 'path';

@Injectable()
export class KbSeedCommand {
  private readonly logger = new Logger(KbSeedCommand.name);

  constructor(private readonly ingestService: KbIngestService) {}

  /**
   * Seed FAQ entries
   */
  async seedFaqs(): Promise<void> {
    this.logger.log('Starting FAQ seed...');

    const result = await this.ingestService.ingestFaqs(FAQ_SEEDS);

    this.logger.log(
      `FAQ seed completed: ${result.success}/${result.total} entries indexed`,
    );

    if (result.failed > 0) {
      this.logger.warn(`${result.failed} FAQ entries failed to index`);
    }
  }

  /**
   * Seed documentation from /docs folder
   */
  async seedDocs(): Promise<void> {
    this.logger.log('Starting docs seed...');

    // Find the docs folder relative to the project root
    const docsPath = path.resolve(__dirname, '../../../../docs');

    this.logger.log(`Looking for docs in: ${docsPath}`);

    const result = await this.ingestService.ingestDocsFolder(docsPath);

    this.logger.log(
      `Docs seed ${result.status}: ${result.processedDocs}/${result.totalDocs} documents indexed`,
    );

    if (result.errorMessage) {
      this.logger.warn(`Docs seed warning: ${result.errorMessage}`);
    }
  }

  /**
   * Run full seed (FAQs + Docs)
   */
  async seedAll(): Promise<void> {
    this.logger.log('Starting full KB seed...');

    await this.seedFaqs();
    await this.seedDocs();

    this.logger.log('Full KB seed completed');
  }
}

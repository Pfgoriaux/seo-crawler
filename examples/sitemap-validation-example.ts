import { validateSitemap, calculateSitemapScore } from '../src/analyzers/sitemap-validator';

/**
 * Example: Validate a sitemap.xml file
 */
async function exampleSitemapValidation() {
  // Example 1: Validate a regular sitemap
  console.log('Validating sitemap...\n');

  const sitemapUrl = 'https://example.com/sitemap.xml';
  const validation = await validateSitemap(sitemapUrl);

  console.log('=== Sitemap Validation Results ===');
  console.log(`URL: ${validation.url}`);
  console.log(`Valid: ${validation.isValid ? '✓' : '✗'}`);
  console.log(`Type: ${validation.isIndex ? 'Sitemap Index' : 'URL Sitemap'}`);
  console.log(`URLs: ${validation.urlCount}`);
  console.log(`Size: ${formatBytes(validation.sizeBytes)}`);
  console.log(`Compressed: ${validation.compressionUsed ? 'Yes' : 'No'}`);
  console.log(`Score: ${calculateSitemapScore(validation)}/100`);

  console.log('\n=== Metadata Coverage ===');
  console.log(`lastmod: ${validation.lastmodPresent}/${validation.urlCount} URLs`);
  console.log(`priority: ${validation.priorityPresent}/${validation.urlCount} URLs`);
  console.log(`changefreq: ${validation.changefreqPresent}/${validation.urlCount} URLs`);

  if (validation.avgPriority !== null) {
    console.log(`Average priority: ${validation.avgPriority.toFixed(2)}`);
  }

  console.log('\n=== Extensions ===');
  console.log(`Images: ${validation.hasImages ? 'Yes' : 'No'}`);
  console.log(`Videos: ${validation.hasVideos ? 'Yes' : 'No'}`);
  console.log(`News: ${validation.hasNews ? 'Yes' : 'No'}`);

  console.log('\n=== Additional Checks ===');
  console.log(`HTTPS Mixed Content: ${validation.httpsMixedContent ? 'Yes (Issue!)' : 'No'}`);
  console.log(`Referenced in robots.txt: ${
    validation.robotsTxtAllowed === null ? 'Unknown' :
    validation.robotsTxtAllowed ? 'Yes' : 'No'
  }`);

  if (validation.isIndex && validation.childSitemaps.length > 0) {
    console.log('\n=== Child Sitemaps ===');
    validation.childSitemaps.slice(0, 5).forEach((sitemap, i) => {
      console.log(`${i + 1}. ${sitemap}`);
    });
    if (validation.childSitemaps.length > 5) {
      console.log(`... and ${validation.childSitemaps.length - 5} more`);
    }
  }

  if (validation.issues.length > 0) {
    console.log('\n=== Issues Found ===');

    const errors = validation.issues.filter(i => i.type === 'error');
    const warnings = validation.issues.filter(i => i.type === 'warning');
    const info = validation.issues.filter(i => i.type === 'info');

    if (errors.length > 0) {
      console.log(`\n❌ Errors (${errors.length}):`);
      errors.slice(0, 5).forEach(issue => {
        console.log(`  - ${issue.message}`);
        if (issue.affectedUrl) {
          console.log(`    URL: ${issue.affectedUrl}`);
        }
      });
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more errors`);
      }
    }

    if (warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${warnings.length}):`);
      warnings.slice(0, 5).forEach(issue => {
        console.log(`  - ${issue.message}`);
        if (issue.affectedUrl) {
          console.log(`    URL: ${issue.affectedUrl}`);
        }
      });
      if (warnings.length > 5) {
        console.log(`  ... and ${warnings.length - 5} more warnings`);
      }
    }

    if (info.length > 0) {
      console.log(`\nℹ️  Info (${info.length}):`);
      info.slice(0, 5).forEach(issue => {
        console.log(`  - ${issue.message}`);
      });
      if (info.length > 5) {
        console.log(`  ... and ${info.length - 5} more info items`);
      }
    }
  } else {
    console.log('\n✓ No issues found!');
  }

  if (validation.duplicateUrls.length > 0) {
    console.log(`\n=== Duplicate URLs (${validation.duplicateUrls.length}) ===`);
    validation.duplicateUrls.slice(0, 5).forEach(url => {
      console.log(`  - ${url}`);
    });
    if (validation.duplicateUrls.length > 5) {
      console.log(`  ... and ${validation.duplicateUrls.length - 5} more duplicates`);
    }
  }

  if (validation.invalidUrls.length > 0) {
    console.log(`\n=== Invalid URLs (${validation.invalidUrls.length}) ===`);
    validation.invalidUrls.slice(0, 5).forEach(url => {
      console.log(`  - ${url}`);
    });
    if (validation.invalidUrls.length > 5) {
      console.log(`  ... and ${validation.invalidUrls.length - 5} more invalid URLs`);
    }
  }

  if (validation.urlsWithoutLastmod.length > 0 && validation.urlsWithoutLastmod.length <= 10) {
    console.log(`\n=== URLs Without lastmod (${validation.urlsWithoutLastmod.length}) ===`);
    validation.urlsWithoutLastmod.forEach(url => {
      console.log(`  - ${url}`);
    });
  }

  console.log('\n' + '='.repeat(50));
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Run the example
if (require.main === module) {
  exampleSitemapValidation().catch(console.error);
}

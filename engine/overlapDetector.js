/**
 * Overlap & Content Cannibalization Detector
 * Cross-references proposed keyword clusters against 370 currently live Lawsons blogs.
 */

const fs = require('fs');
const path = require('path');

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'for', 'with', 'to', 'in', 'on', 'at', 'of',
  'how', 'what', 'why', 'which', 'when', 'where', 'guide', 'tips', 'everything',
  'you', 'need', 'know', 'about', 'best', 'top', 'online', 'uk', 'near', 'me',
  'buy', 'supplies', 'complete', 'lawsons', 'group', 'vs', 'versus', 'compared'
]);

function extractCoreTokens(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/[\s-]+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

class OverlapDetector {
  constructor(existingBlogsJsonPath) {
    this.existingBlogs = [];
    if (existingBlogsJsonPath && fs.existsSync(existingBlogsJsonPath)) {
      try {
        const raw = fs.readFileSync(existingBlogsJsonPath, 'utf8').replace(/^\uFEFF/, '');
        this.existingBlogs = JSON.parse(raw);
        this.indexBlogs();
      } catch (err) {
        console.error('Failed to parse existing blogs JSON:', err.message);
      }
    }
  }

  indexBlogs() {
    this.existingBlogs.forEach(blog => {
      const titleTokens = extractCoreTokens(blog.Title || '');
      const urlTokens = extractCoreTokens(blog['Url Key'] || '');
      const combined = new Set([...titleTokens, ...urlTokens]);
      blog._tokens = combined;
      blog._tokenList = Array.from(combined);
      blog.liveUrl = `https://www.lawsons.co.uk/blog/${blog['Url Key'] || ''}`;
    });
  }

  checkOverlap(targetKeyword, recommendedTitle) {
    if (!this.existingBlogs || this.existingBlogs.length === 0) {
      return {
        overlapStatus: 'Net-New Opportunity',
        matchedBlog: null
      };
    }

    const kwTokens = extractCoreTokens(targetKeyword);
    const titleTokens = extractCoreTokens(recommendedTitle);
    const candidateTokens = Array.from(new Set([...kwTokens, ...titleTokens]));

    if (candidateTokens.length === 0) {
      return { overlapStatus: 'Net-New Opportunity', matchedBlog: null };
    }

    let bestMatch = null;
    let highestScore = 0;

    for (const blog of this.existingBlogs) {
      const blogTokens = blog._tokens;
      const intersection = candidateTokens.filter(t => blogTokens.has(t));

      if (intersection.length >= 2) {
        // Direct overlap if primary keyword core tokens are largely covered
        const kwIntersection = kwTokens.filter(t => blogTokens.has(t));
        const kwCoverage = kwTokens.length > 0 ? kwIntersection.length / kwTokens.length : 0;

        const diceScore = (intersection.length * 2) / (candidateTokens.length + blog._tokenList.length);

        if (kwCoverage >= 0.65 || (intersection.length >= 3 && diceScore > 0.45)) {
          if (diceScore > highestScore) {
            highestScore = diceScore;
            bestMatch = {
              id: blog.ID || '',
              title: blog.Title || '',
              urlKey: blog['Url Key'] || '',
              liveUrl: blog.liveUrl,
              category: blog.Categories || '',
              publishedStatus: blog.Status || 'Published',
              matchedTokens: intersection,
              similarityScore: parseFloat((diceScore * 100).toFixed(1)),
              recommendation: 'Refresh existing live blog URL rather than publishing a cannibalizing duplicate'
            };
          }
        }
      }
    }

    if (bestMatch) {
      return {
        overlapStatus: 'Direct Live Match',
        matchedBlog: bestMatch
      };
    }

    return {
      overlapStatus: 'Net-New Opportunity',
      matchedBlog: null
    };
  }
}

module.exports = {
  OverlapDetector,
  extractCoreTokens
};

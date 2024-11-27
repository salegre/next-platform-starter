import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import connectMongoDB from 'utils/mongodb-connection';
import { Ranking } from 'models/Ranking';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const url = searchParams.get('url');

  if (!keyword || !url) {
    return NextResponse.json({ 
      error: 'Missing keyword or URL' 
    }, { status: 400 });
  }

  try {
    // Connect to MongoDB
    await connectMongoDB();

    // TEST PAUSE
    const serpResponse = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
      }
    });

    const results = serpResponse.data.organic_results || [];
    
    // Find the ranking of the specified URL
    const ranking = results.findIndex(
      (result: any) => result.link.includes(url)
    );

    
    // Prepare ranking data

    const rankingData = {
      url,
      keyword,
    // OG
    position: ranking !== -1 ? ranking + 1 : null,
    title: sanitizeString(ranking !== -1 ? results[ranking].title : undefined),
    linkUrl: sanitizeString(ranking !== -1 ? results[ranking].link : undefined)

    // Testing
    // position: 1,
    //   title: sanitizeString("Title"),
    //   linkUrl: sanitizeString( "https://test.com")

    };

        // Save to MongoDB with detailed logging
    try {
      const newRanking = new Ranking(rankingData);
      const savedRanking = await newRanking.save();
      console.log('Ranking saved successfully:', savedRanking);

      // Return the ranking
      return NextResponse.json({
        ...rankingData,
        savedId: savedRanking._id
      });

    } catch (saveError) {
      console.error('Error saving ranking to MongoDB:', saveError);
      return NextResponse.json({ 
        error: 'Failed to save ranking', 
        details: saveError instanceof Error ? saveError.message : 'Unknown save error' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('SerpAPI Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch rankings', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

function sanitizeString(input: string | undefined): string | undefined {
  if (!input) return undefined;
  
  // Remove non-printable characters and ensure valid UTF-8
  return input.normalize('NFC')  // Normalize Unicode characters
    .replace(/[^\x20-\x7E]/g, '')  // Remove non-printable characters
    .trim();  // Remove leading/trailing whitespace
}
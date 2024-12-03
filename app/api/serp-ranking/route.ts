import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import connectMongoDB from 'utils/mongodb-connection';
import { Ranking } from 'models/Ranking';
import { getTokenData } from 'utils/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const url = searchParams.get('url');
  let location = searchParams.get('location') || 'Global';
  let country = searchParams.get('country') || 'Global';

  if (!keyword || !url) {
    return NextResponse.json({ error: 'Missing keyword or URL' }, { status: 400 });
  }

  try {
    await connectMongoDB();
    const userData = await getTokenData(request);
    if (!userData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serpParams: any = {
      engine: 'google',
      q: keyword,
      api_key: process.env.SERPAPI_KEY
    };

    // Set location and country parameters only if they are not "Global"
    if (location !== 'Global') {
      serpParams.location = location;
    }
    if (country !== 'Global') {
      serpParams.gl = country; // Google country code
    }

    const serpResponse = await axios.get('https://serpapi.com/search', {
      params: serpParams
    });

    const results = serpResponse.data.organic_results || [];
    const ranking = results.findIndex(result => result.link.includes(url));
    const currentPosition = ranking !== -1 ? ranking + 1 : null;

    // Only proceed if we found a position
    if (currentPosition === null) {
      return NextResponse.json({ error: 'URL not found in results' }, { status: 404 });
    }

    const existingRanking = await Ranking.findOne({ 
      user: userData.id, 
      url, 
      keyword,
      location,
      country
    });

    const newHistoryEntry = {
      position: currentPosition,
      date: new Date(),
      type: 'organic',
      landingPage: url
    };

    if (existingRanking) {
      // Update existing ranking
      const updatedRanking = await Ranking.findByIdAndUpdate(
        existingRanking._id,
        {
          $set: { 
            position: currentPosition,
            title: results[ranking].title,
            linkUrl: results[ranking].link,
          },
          $push: { 
            positionHistory: newHistoryEntry
          }
        },
        { new: true, runValidators: true }
      );
      return NextResponse.json(updatedRanking);
    } else {
      // Create new ranking
      const newRanking = new Ranking({
        user: userData.id,
        url,
        keyword,
        location,
        country,
        position: currentPosition,
        title: results[ranking].title,
        linkUrl: results[ranking].link,
        positionHistory: [newHistoryEntry],
        createdAt: new Date()
      });
      await newRanking.save();
      return NextResponse.json(newRanking);
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to process ranking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
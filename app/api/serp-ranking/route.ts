import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import connectMongoDB from 'utils/mongodb-connection';
import { Ranking } from 'models/Ranking';
import { getTokenData } from 'utils/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const url = searchParams.get('url');

  if (!keyword || !url) {
    return NextResponse.json({ error: 'Missing keyword or URL' }, { status: 400 });
  }

  try {
    await connectMongoDB();
    const userData = await getTokenData(request);
    if (!userData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serpResponse = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
      }
    });

    const results = serpResponse.data.organic_results || [];
    const ranking = results.findIndex(result => result.link.includes(url));
    const currentPosition = ranking !== -1 ? ranking + 1 : null;

    const existingRanking = await Ranking.findOne({ 
      user: userData.id, 
      url, 
      keyword 
    });

    if (existingRanking) {
      await Ranking.updateOne(
        { _id: existingRanking._id },
        {
          $set: { position: currentPosition },
          $push: { 
            positionHistory: {
              position: currentPosition,
              date: new Date()
            }
          }
        }
      );
    } else {
      const newRanking = new Ranking({
        user: userData.id,
        url,
        keyword,
        position: currentPosition,
        title: sanitizeString(ranking !== -1 ? results[ranking].title : undefined),
        linkUrl: sanitizeString(ranking !== -1 ? results[ranking].link : undefined),
        positionHistory: [{
          position: currentPosition,
          date: new Date()
        }],
        createdAt: new Date()
      });
      await newRanking.save();
    }

    return NextResponse.json(await Ranking.findOne({ user: userData.id, url, keyword }));
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to process ranking' }, { status: 500 });
  }
}

function sanitizeString(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return input.normalize('NFC')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}
import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from 'utils/mongodb-connection';
import { Ranking } from 'models/Ranking';
import { getTokenData } from 'utils/auth';

interface PositionHistoryEntry {
  date: Date;
  position: number;
  type: string;
  landingPage: string;
}

interface RankingUpload {
  keyword: string;
  searchVolume: number;
  cpc: number;
  difficulty: number;
  positionHistory: PositionHistoryEntry[];
}

export async function POST(request: NextRequest) {
  try {
    await connectMongoDB();
    
    const userData = await getTokenData(request);
    if (!userData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rankings } = await request.json() as { rankings: RankingUpload[] };
    
    console.log('Received rankings data:', rankings); // Debug log

    const bulkOps = rankings.map(rankingData => {
      // Get the most recent position entry
      const latestPositionEntry = rankingData.positionHistory.length > 0 
        ? rankingData.positionHistory[rankingData.positionHistory.length - 1]
        : null;

      const formattedPositionHistory = rankingData.positionHistory.map(history => ({
        position: history.position,
        date: new Date(history.date),
        type: history.type,
        landingPage: history.landingPage
      }));

      console.log(`Processing keyword: ${rankingData.keyword}`, {
        latestPosition: latestPositionEntry?.position,
        historyCount: formattedPositionHistory.length
      }); // Debug log

      return {
        updateOne: {
          filter: {
            user: userData.id,
            keyword: rankingData.keyword
          },
          update: {
            $set: {
              position: latestPositionEntry?.position || null,
              searchVolume: rankingData.searchVolume,
              cpc: rankingData.cpc,
              keywordDifficulty: rankingData.difficulty,
              url: latestPositionEntry?.landingPage || '',
              // Only update position history if we have new data
              ...(formattedPositionHistory.length > 0 && {
                positionHistory: formattedPositionHistory
              })
            }
          },
          upsert: true
        }
      };
    });

    if (bulkOps.length > 0) {
      const result = await Ranking.bulkWrite(bulkOps);
      console.log('Bulk write result:', result); // Debug log

      return NextResponse.json({
        success: true,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      });
    }

    return NextResponse.json({
      success: false,
      error: 'No valid rankings data provided'
    }, { status: 400 });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to process rankings upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
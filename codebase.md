# .eslintrc.json

```json
{
    "extends": "next/core-web-vitals",
    "rules": {
        "@next/next/no-img-element": "off"
    }
}

```

# .gitignore

```
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# local env files
.env*
!.env.example

# vercel
.vercel

# stackbit
.cache
.stackbit/cache

# Local Netlify folder
.netlify

```

# .prettierrc

```
{
    "printWidth": 120,
    "singleQuote": true,
    "trailingComma": "none",
    "tabWidth": 4,
    "overrides": [
        {
            "files": ["*.md", "*.yaml"],
            "options": {
                "tabWidth": 2
            }
        }
    ]
}

```

# app/api/login/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectMongoDB from 'utils/mongodb-connection';
import { User } from 'models/User';

export async function POST(request: NextRequest) {
  console.log('Login route hit'); // Initial log

  
  
  await connectMongoDB();

  try {
    const body = await request.json();
    console.log('Request body:', body); // Log the incoming body

    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return NextResponse.json({ 
        error: 'Email and password are required' 
      }, { status: 400 });
    }

    // Find user
    const user = await User.findOne({ email });
    console.log('User found:', user); // Log the found user

    if (!user) {
      console.log('No user found with this email');
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch); // Log password comparison result

    if (!isMatch) {
      console.log('Password does not match');
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }

    // Create token
    // const token = jwt.sign(
    //   { id: user._id, email: user.email },
    //   process.env.JWT_SECRET!,
    //   { expiresIn: '1d' }
    // );

    const token = jwt.sign(
        { id: user._id.toString(), email: user.email },
        process.env.JWT_SECRET!,
        { 
          expiresIn: '1d',
          algorithm: 'HS256' // Explicitly specify algorithm
        }
      );



    // Remove password from response
    const userResponse = {
      _id: user._id,
      email: user.email
    };

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
            algorithms: ['HS256']
        });
        console.log('Decoded token:', decoded);
        } catch (err) {
        console.error('Detailed verification error:', {
            name: err.name,
            message: err.message,
            stack: err.stack
        });
    }

    // Set token in HTTP-only cookie
    const response = NextResponse.json(userResponse, { status: 200 });
response.headers.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
response.headers.set('Access-Control-Allow-Credentials', 'true');

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 1 day
    });
    console.log(response);
    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      error: 'Login failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }

  
}
```

# app/api/rankings/[id]/route.ts

```ts
// app/api/rankings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Ranking } from 'models/Ranking';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';

// Add this type
type RouteSegment = {
  params: { id: string }
};

// Update function signature
export async function GET(
  request: NextRequest,
  segment: RouteSegment
) {
  try {
    await connectMongoDB();
    const userData = await getTokenData(request);
    if (!userData) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ranking = await Ranking.findOne({ 
      _id: segment.params.id,
      user: userData.id 
    });

    if (!ranking) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(ranking);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch ranking' }, { status: 500 });
  }
}
```

# app/api/rankings/route.ts

```ts
// app/api/rankings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Ranking } from 'models/Ranking';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';

export async function GET(request: NextRequest) {
  try {
    await connectMongoDB();
    
    const userData = await getTokenData(request);
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rankings = await Ranking.find({ user: userData.id }).sort({ createdAt: -1 });
    return NextResponse.json(rankings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }
}
```

# app/api/register/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectMongoDB from 'utils/mongodb-connection';
import { User } from 'models/User';

export async function POST(request: NextRequest) {
  await connectMongoDB();

  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ 
        error: 'Email and password are required' 
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ 
        error: 'User already exists' 
      }, { status: 409 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      email,
      password: hashedPassword
    });

    await newUser.save();

    // Remove password from response
    const userResponse = {
      _id: newUser._id,
      email: newUser.email
    };

    return NextResponse.json(userResponse, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ 
      error: 'Registration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
```

# app/api/serp-ranking/route.ts

```ts
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

    const existingRanking = await Ranking.findOne({ 
      user: userData.id, 
      url, 
      keyword,
      location,
      country
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
        location,
        country,
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

    return NextResponse.json(await Ranking.findOne({ 
      user: userData.id, 
      url, 
      keyword,
      location,
      country 
    }));
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
```

# app/api/user/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectMongoDB from 'utils/mongodb-connection';
import { User } from 'models/User';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

    // Connect to MongoDB
    await connectMongoDB();

    // Find user
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      email: user.email,
      id: user._id 
    });

  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

# app/blobs/actions.js

```js
'use server';
import { getStore } from '@netlify/blobs';
import { uploadDisabled } from 'utils';

function store() {
    return getStore({ name: 'shapes', consistency: 'strong' });
}

// Always be sanitizing data in real sites!
export async function uploadShapeAction({ parameters }) {
    if (uploadDisabled) throw new Error('Sorry, uploads are disabled');

    const key = parameters.name;
    await store().setJSON(key, parameters);
    console.log('Stored shape with parameters:', parameters, 'to key:', key);
}

export async function listShapesAction() {
    const data = await store().list();
    const keys = data.blobs.map(({ key }) => key);
    return keys;
}

export async function getShapeAction({ keyName }) {
    const data = await store().get(keyName, { type: 'json' });
    return data;
}

```

# app/blobs/editor.jsx

```jsx
'use client';

import { useState } from 'react';
import { StoredBlobsList } from './list';
import { NewShape } from './new-shape';

export function ShapeEditor(props) {
    // Allow new shape editor to signal that a mutation has occured, triggering the list
    // of stored blobs to be reloaded (you can also use form actions)
    const [lastMutationTime, setLastMutationTime] = useState(0);

    return (
        <div className="flex w-full flex-col md:flex-row md:items-start gap-8">
            <div className="md:w-2/5">
                <NewShape setLastMutationTime={setLastMutationTime} />
            </div>
            <div className='w-full'>
                <StoredBlobsList lastMutationTime={lastMutationTime} />
            </div>
        </div>
    );
}

```

# app/blobs/generator.js

```js
import blobshape from 'blobshape';
import { randomInt, uniqueName } from 'utils';

const gradientColors = [
    ['#e96443', '#904e95'],
    ['#ff5f6d', '#ffc371'],
    ['#eecda3', '#ef629f'],
    ['#4ca1af', '#c4e0e5'],
    ['#c2e59c', '#64b3f4'],
    ['#3ca55c', '#b5ac49']
];

export const fixedSize = 512;

/*
If given existing parameters, creates SVG path based on it (so you can store just the params, not the actual path).
If not, creates new parameter values first.

Returns { parameters, svgPath }.
*/
export function generateBlob(parameters) {
    parameters = {
        seed: null,
        edges: randomInt(3, 20),
        growth: randomInt(2, 9),
        colors: gradientColors[randomInt(0, gradientColors.length - 1)],
        name: uniqueName(),
        ...parameters
    };

    // If seed is not given, a new seed is generated and returned (so it can be stored)
    const { path: svgPath, seedValue: seed } = blobshape({ ...parameters, size: fixedSize });
    return { parameters: { ...parameters, seed }, svgPath };
}

```

# app/blobs/list.jsx

```jsx
'use client';
import { useEffect, useState } from 'react';
import { listShapesAction, getShapeAction } from './actions';
import { ShapeRenderer } from './renderer';
import { generateBlob } from './generator';

export function StoredBlobsList({ lastMutationTime }) {
    const [keys, setKeys] = useState([]);
    const [selectedKey, setSelectedKey] = useState();
    const [previewData, setPreviewData] = useState();

    useEffect(() => {
        console.log('Fetching keys...');
        listShapesAction().then((response) => {
            setKeys(response);
        });
    }, [lastMutationTime]);

    const onSelect = async (keyName) => {
        setSelectedKey(keyName);
        const data = await getShapeAction({ keyName });
        setPreviewData(data);
    };

    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <div className="text-lg font-bold h-6">Objects in Blob Store</div>
            <div className="flex flex-col gap-1 w-full bg-white text-neutral-900 min-h-56 card">
                <div className="card-body text-md">
                    {!keys?.length ? (
                        <span>Please upload some shapes!</span>
                    ) : (
                        keys.map((keyName) => {
                            const isSelected = keyName === selectedKey;
                            return (
                                <div
                                    key={keyName}
                                    onClick={() => {
                                        onSelect(keyName);
                                    }}
                                    className={'w-full hover:bg-neutral-200 ' + (isSelected ? 'font-bold' : '')}
                                >
                                    {keyName}
                                </div>
                            );
                        })
                    )}
                    {previewData && <BlobPreview data={previewData} />}
                </div>
            </div>
        </div>
    );
}

function BlobPreview({ data }) {
    const fullBlobData = generateBlob(data); // Recreates the SVG path by the existing parameters
    return (
        <div className="mt-4 lg:mx-16 border border-neutral-800 rounded">
            <div className="p-2 text-center">{data.name}</div>
            <div className="bg-neutral-800 text-neutral-100 p-2 font-mono">{JSON.stringify(data, null, ' ')}</div>
            <ShapeRenderer svgPath={fullBlobData.svgPath} colors={fullBlobData.parameters.colors} />
        </div>
    );
}

```

# app/blobs/new-shape.jsx

```jsx
'use client';

import { useEffect, useState } from 'react';
import { generateBlob } from 'app/blobs/generator';
import { ShapeRenderer } from './renderer';
import { uploadShapeAction } from './actions';
import { uploadDisabled } from 'utils';

export function NewShape(props) {
    const { setLastMutationTime } = props;
    const [blobData, setBlobData] = useState();
    const [wasUploaded, setWasUploaded] = useState(false);

    const randomizeBlob = () => {
        setBlobData(generateBlob());
        setWasUploaded(false);
    };

    const onUpload = async () => {
        await uploadShapeAction({ parameters: blobData.parameters });
        setWasUploaded(true);
        setLastMutationTime(Date.now());
    };

    useEffect(() => {
        if (!blobData) {
            randomizeBlob();
        }
    }, [blobData]);

    return (
        <div className="flex flex-col items-center justify-center w-full gap-2">
            <div className="text-lg font-bold">New Random Shape</div>
            <div className="rounded bg-white">
                <div className="text-md w-full text-center text-neutral-900 text-lg p-2 border-b border-neutral-900">
                    {blobData?.parameters?.name}
                </div>
                <div className="p-2">
                    <ShapeRenderer svgPath={blobData?.svgPath} colors={blobData?.parameters?.colors} />
                </div>
            </div>
            <div className="flex justify-center gap-4">
                <button className="btn btn-primary" onClick={randomizeBlob}>
                    Randomize
                </button>
                <button className="btn btn-primary" onClick={onUpload} disabled={uploadDisabled || wasUploaded || !blobData}>
                    Upload
                </button>
            </div>
        </div>
    );
}

```

# app/blobs/page.jsx

```jsx
import { Markdown } from 'components/markdown';
import { ShapeEditor } from './editor';
import { ContextAlert } from 'components/context-alert';
import { getNetlifyContext, uploadDisabled } from 'utils';

export const metadata = {
    title: 'Blobs'
};

const explainer = `
[Netlify Blobs](https://docs.netlify.com/blobs/overview/) provides an object store for any kind of data, be it JSON, binary, 
or [really](https://mk.gg/projects/chalkstream) anything else ([really!](https://mk.gg/projects/turbofan)). In this example, the blob store is used to **hold the data of user-generated random blobby shapes**.

Using the blob store is basically zero-config. Below is a Next.js Server Action to upload data (see \`app/blobs/actions.js\`). 
When deployed to Netlify, the Server Action is run by serverless functions, and all context required for the blob service is set-up automatically.

~~~js
'use server';
import { getStore } from '@netlify/blobs';

// TODO: Always be sanitizing data in real sites!
export async function uploadShape({ shapeData }) {
    const blobStore = getStore('shapes');
    const key = data.name;
    await blobStore.setJSON(key, shapeData);
}
~~~

Click "Randomize" to get a shape you like, then hit "Upload".
Choose any existing object to view it.
`;

const uploadDisabledText = `
User uploads are disabled in this site. To run your own and try it out: 
<a href="https://app.netlify.com/start/deploy?repository=https://github.com/netlify-templates/next-platform-starter">
<img src="https://www.netlify.com/img/deploy/button.svg" style="display: inline;" alt="Deploy to Netlify" />
</a>
`;

export default async function Page() {
    return (
        <>
            <section className="flex flex-col gap-6 sm:gap-8">
                <ContextAlert
                    addedChecksFunction={(ctx) => {
                        return uploadDisabled ? uploadDisabledText : null;
                    }}
                />
                <h1>Blobs x Blobs</h1>
            </section>
            {!!getNetlifyContext() && (
                <div className="flex flex-col gap-8">
                    <Markdown content={explainer} />
                    <ShapeEditor />
                </div>
            )}
        </>
    );
}

```

# app/blobs/renderer.jsx

```jsx
import { fixedSize } from './generator';
import { randomInt } from 'utils';

// See: https://github.com/lokesh-coder/blobs.app/blob/master/src/components/Blob.js
export function ShapeRenderer(props) {
    const { svgPath, colors } = props;
    const uniqueGradientId = `gradient-${randomInt(10_000_000, 100_000_000)}` 
    return (
        <div className="w-full bg-white text-primary aspect-square">
            {!!svgPath && !!colors && (
            <svg
                viewBox={`0 0 ${fixedSize} ${fixedSize}`}
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                width="100%"
            >
                <>
                    <defs>
                        <linearGradient id={uniqueGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: colors[0] }} />
                            <stop offset="100%" style={{ stopColor: colors[1] }} />
                        </linearGradient>
                    </defs>
                    <path id="blob" d={svgPath} fill={`url(#${uniqueGradientId})`} />
                </>
            </svg>)}
        </div>
    );
}

```

# app/classics/page.jsx

```jsx
import { FeedbackForm } from 'components/feedback-form';
import { Markdown } from '../../components/markdown';

export const metadata = {
    title: 'Classics'
};

const explainer = `
Some classic (and much-loved) Netlify features were born when most sites we hosted were fully static.
For example, [Netlify Forms](https://docs.netlify.com/forms/setup/) do their magic based on automatic detection of specially-marked form tags in static HTML files. 

This has [required some adjustments](https://docs.netlify.com/forms/setup/#javascript-forms) for the age of SPA and SSR. 
With modern Next.js versions, no page is truly static: as a developer, you can revalidate any page. However, you can still use our forms.

Below is a simple form using \`fetch\` to submit its data to Netlify rather than using full-page navigation. To be detected, form tags must be hosted in static files -
and \`public/__forms.html\` exists just for this purpose.

Deploy this site to your Netlify account, [enable the forms feature in the UI](https://docs.netlify.com/forms/setup/#enable-form-detection), trigger a build and you can start collecting submissions.
`;

export default async function Page() {
    return (
        <>
            <h1>Netlify Classics</h1>
            <Markdown content={explainer} />
            <div className="flex w-full pt-12 justify-center">
                <FeedbackForm />
            </div>
        </>
    );
}
```

# app/dashboard/page.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from 'components/card';
import { IRanking } from 'models/Ranking';
import { IUser } from 'models/User';
import { RankingsTable } from '@/components/rankings-table';
import { KeywordRankingForm } from '@/app/keyword-ranking-form';

export default function Page() {
  const [user, setUser] = useState<IUser | null>(null);
  const [rankings, setRankings] = useState<IRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const [userResponse, rankingsResponse] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/rankings')
        ]);

        if (!userResponse.ok || !rankingsResponse.ok) throw new Error('Failed to fetch data');

        const [userData, rankingsData] = await Promise.all([
          userResponse.json(),
          rankingsResponse.json()
        ]);

        setUser(userData);
        setRankings(rankingsData);
      } catch (error) {
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (isLoading) return (
    <Card 
      title="Loading..." 
      text=""
      linkText=""
      href=""
    > </Card>
  );

  return (
    <main className="container mx-auto p-6">
      <section className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-gray-600">Welcome, {user?.email}</p>
          </div>
          <button 
            onClick={() => fetch('/api/logout', { method: 'POST' }).then(() => router.push('/login'))}
            className="btn btn-error"
          >
            Logout
          </button>
        </div>

        <Card 
          title="Your Rankings"
          text="" 
          linkText=""
          href=""
          >
        {rankings.length === 0 ? (
          <p>No keywords tracked yet.</p>
        ) : (
          <RankingsTable rankings={rankings} />
        )}
        </Card>
        <KeywordRankingForm />
      </section>
    </main>
  );
}
```

# app/edge/australia/page.jsx

```jsx
import EdgeFunctionExplainer from '../explainer';

export const metadata = {
    title: 'In Australia'
};

export default function Page() {
    return (
        <>
            <h1>You are in Australia!</h1>
            <EdgeFunctionExplainer />
        </>
    );
}

```

# app/edge/explainer.jsx

```jsx
import { Markdown } from "components/markdown";

const explainer = `
This page is using a Netlify Edge Function (\`netlify/edge-functions/rewrite.js\`) to rewrite the URL based on visitor geography.

~~~js
const rewrite = async (request, context) => {
    const path = context.geo?.country?.code === 'AU' ? '/edge/australia' : '/edge/not-australia';
    return new URL(path, request.url);
};

export const config = {
    path: '/edge'
};

export default rewrite;
~~~

[See more examples](https://edge-functions-examples.netlify.app)
`;

export default function EdgeFunctionExplainer() {
    return <Markdown content={explainer} />    
}

```

# app/edge/not-australia/page.jsx

```jsx
import EdgeFunctionExplainer from '../explainer';

export const metadata = {
    title: 'Not Australia'
};

export default function Page() {
    return (
        <>
            <h1>You&apos;re not in Australia!</h1>
            <EdgeFunctionExplainer />
        </>
    );
}

```

# app/edge/page.jsx

```jsx
import Link from 'next/link';
import { Alert } from '../../components/alert';
import { Markdown } from 'components/markdown';

export const metadata = {
    title: 'Fallback'
};

const explainer = `
This page is using a [Netlify Edge Function](https://docs.netlify.com/edge-functions/overview/) to rewrite the URL based on visitor geography.

For it to be invoked, please either run this site locally with \`netlify dev\` or deploy it to Netlify.

Edge Functions are framework-agnostic, but are also used behind the scenes to run Next.js Middleware on Netlify.
There are advatanges to using Edge Functions directly, such as the ability to access & transform the response body.

[See more examples](https://edge-functions-examples.netlify.app)
`

export default function FallbackPage() {
    return (
        <>
            <h1>You&apos;ve reached the fallback page.</h1>
            <Markdown content={explainer} />
        </>
    );
}

```

# app/image-cdn/image-with-size-overlay.jsx

```jsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getResourceSize } from 'utils';

export function ImageWithSizeOverlay({ src, srcSet, sizes, overlayPosition }) {
    const imageRef = useRef();
    const [imgSize, setImgSize] = useState(undefined);

    const handleImageLoad = useCallback(() => {
        const imgElement = imageRef.current;
        if (imgElement?.complete) {
            const size = getResourceSize(imgElement?.currentSrc);
            setImgSize(size);
        } else {
            setImgSize(undefined);
        }
    }, []);

    useEffect(() => {
        handleImageLoad();
    }, [handleImageLoad]);

    return (
        <div className="relative">
            {imgSize && (
                <span
                    className={`absolute py-1.5 px-2.5 text-sm rounded-lg bg-neutral-900/70 top-2.5 ${
                        overlayPosition === 'right' ? 'right-2.5' : 'left-2.5'
                    }`}
                >{`Size: ${Math.ceil(imgSize / 1024)}KB`}</span>
            )}

            <img src={src} srcSet={srcSet} sizes={sizes} alt="Corgi" onLoad={handleImageLoad} ref={imageRef} />
        </div>
    );
}

```

# app/image-cdn/page.jsx

```jsx
import Image from 'next/image';
import { Markdown } from 'components/markdown';
import { getNetlifyContext } from 'utils';
import { ImageWithSizeOverlay } from './image-with-size-overlay';
import { ContextAlert } from 'components/context-alert';

export const metadata = {
    title: 'Image CDN'
};

const sampleImage = '/images/corgi.jpg';

const ctx = getNetlifyContext();
const forceWebP = ctx === 'dev';
const sampleImageSrcSet = [640, 1280, 2048]
    .map((size) => {
        return `/.netlify/images?url=${sampleImage}&w=${size}${forceWebP ? '&fm=webp' : ''} ${size}w`;
    })
    .join(', ');

const nextImageSnippet = `
When running on Netlify, \`next/image\` is automatically set-up to use Netlify Image CDN for optimized images.

~~~jsx
import Image from 'next/image';

// In your component
<Image src="/images/corgi.jpg" alt="Corgi" /* ... additional props */ />
~~~
`;

const originalVsCdnSnippet = `
In the code below, a regular \`<img>\` tag is used in both cases for a framework-agnostic example. 
Other than using \`next/image\` or rolling your own \`<img>\` tags, you can also use the excellent [unpic-img](https://unpic.pics/).

~~~jsx
// <== On the left, the original image
<img src="/images/corgi.jpg" alt="Corgi" />

// ==> On the right, explicitly using Netlify Image CDN endpoint for a responsive image
<img 
  srcSet="/.netlify/images?url=images/corgi.jpg&w=640 640w, /.netlify/images?url=images/corgi.jpg&w=1280 1280w, /.netlify/images?url=images/corgi.jpg&w=2048 2048w"
  sizes="(max-width: 1024px) 100vw, 1024px" 
  alt="Corgi" 
/>
~~~
`;

const devModeWarning = `
In local development, optimization is performed locally without automatic format
detection, so format is set to WebP.
`;

export default function Page() {
    return (
        <div className="flex flex-col gap-6 sm:gap-12">
            <section className="flex flex-col items-start gap-6 sm:gap-8">
                <ContextAlert addedChecksFunction={
                    (ctx) => {
                        return ctx === "dev" ? devModeWarning : null;
                    }
                } />
                <h1 className="mb-0">Image CDN</h1>
            </section>
            <section>
                <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Using next/image component</h2>
                <Markdown content={nextImageSnippet} />
                <div
                    className="mt-8 overflow-hidden border-2 border-white rounded-lg relative max-w-screen-lg"
                    style={{ aspectRatio: '3/2' }}
                >
                    <Image
                        src="/images/corgi.jpg"
                        priority
                        fill={true}
                        style={{ objectFit: 'contain' }}
                        sizes="(max-width: 1024px) 100vw, 1024px"
                        alt="Corgi"
                    />
                </div>
                <span className="text-sm italic">
                    Credit: photo by{' '}
                    <a href="https://unsplash.com/@alvannee?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">
                        Alvan Nee
                    </a>{' '}
                    on{' '}
                    <a href="https://unsplash.com/photos/long-coated-white-and-brown-dog-lvFlpqEvuRM?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">
                        Unsplash
                    </a>
                </span>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
                    Original vs. optimized image: can you tell the difference?
                </h2>
                <Markdown content={originalVsCdnSnippet} />
                <div className="diff aspect-[3/2] rounded-lg border-2 border-white mt-8">
                    <div className="diff-item-1">
                        <div>
                            <ImageWithSizeOverlay
                                srcSet={sampleImageSrcSet}
                                sizes={sampleImageSrcSet}
                                overlayPosition="right"
                            />
                        </div>
                    </div>
                    <div className="diff-item-2">
                        <div>
                            <ImageWithSizeOverlay src="/images/corgi.jpg" />
                        </div>
                    </div>
                    <div className="diff-resizer"></div>
                </div>
            </section>
        </div>
    );
}

```

# app/keyword-ranking-form.tsx

```tsx
'use client';

import { useState } from 'react';
import axios from 'axios';

interface RankingResult {
  keyword: string;
  position: number | null;
  title?: string;
  link?: string;
  location?: string;
  country?: string;
  error?: string;
}

export function KeywordRankingForm() {
  const [url, setUrl] = useState('');
  const [keywords, setKeywords] = useState(['', '', '']);
  const [location, setLocation] = useState('Global');
  const [country, setCountry] = useState('Global');
  const [rankings, setRankings] = useState<RankingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };

  const checkRankings = async () => {
    if (!url || keywords.every(k => k.trim() === '')) {
      setError('Please enter a URL and at least one keyword');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRankings([]);

    try {
      const results = await Promise.all(
        keywords
          .filter(keyword => keyword.trim() !== '')
          .map(async (keyword) => {
            try {
              const response = await axios.get('/api/serp-ranking', {
                params: { 
                  keyword, 
                  url,
                  location,
                  country
                }
              });
              
              // Ensure we have a valid response
              if (response.data) {
                return response.data;
              }
              
              // If no valid response, return a structured error result
              return {
                keyword,
                position: null,
                location,
                country,
                error: 'Keyword not found in top 100 results'
              };
            } catch (error) {
              console.error(`Error checking ranking for ${keyword}:`, error);
              return {
                keyword,
                position: null,
                location,
                country,
                error: error instanceof Error ? error.message : 'An error occurred'
              };
            }
          })
      );

      setRankings(results.filter(result => result !== null));
    } catch (error) {
      setError('Failed to check rankings');
      console.error('Error checking rankings:', error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Keyword Ranking Checker</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="url">
          Website URL
        </label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter website URL (e.g., example.com)"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Location
        </label>
        <select 
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            if (e.target.value === 'Global') {
              setCountry('Global');
            } else if (e.target.value === 'United States') {
              setCountry('US');
            } else if (e.target.value === 'Nashville, TN') {
              setCountry('US');
            } else if (e.target.value === 'Lima, Peru') {
              setCountry('PE');
            }
          }}
          className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        >
          <option value="Global">Global</option>
          <option value="United States">United States</option>
          <option value="Nashville, TN">Nashville, TN</option>
          <option value="Lima, Peru">Lima, Peru</option>
        </select>
      </div>

      {keywords.map((keyword, index) => (
        <div key={index} className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Keyword {index + 1}
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => handleKeywordChange(index, e.target.value)}
            placeholder={`Enter keyword ${index + 1}`}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          onClick={checkRankings}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
        >
          {isLoading ? 'Checking...' : 'Check Rankings'}
        </button>
      </div>

      {rankings.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Ranking Results</h3>
          <ul className="list-disc pl-5">
            {rankings.map((result, index) => {
              if (!result) return null;
              
              return (
                <li 
                  key={index} 
                  className={`mb-2 ${
                    result.error ? 'text-red-600' :
                    result.position ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {result.keyword} ({result.location || 'Global'}): {' '}
                  {result.error ? `Error: ${result.error}` :
                   result.position ? `Position ${result.position}` : 
                   'Not found in top 100 results'}
                  {result.title && result.position && (
                    <span className="block text-sm text-gray-500">
                      Title: {result.title}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
```

# app/keyword/[id]/page.tsx

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Ranking {
  _id: string;
  keyword: string;
  url: string;
  position: number;
  title: string;
  linkUrl: string;
  location: string;
  country: string;
  positionHistory: {
    position: number;
    date: string;
  }[];
  createdAt: string;
}

export default function KeywordDetails({ params }: { params: { id: string } }) {
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/rankings/${params.id}`)
      .then(res => res.json())
      .then(data => setRanking(data))
      .catch(() => router.push('/dashboard'));
  }, [params.id, router]);

  if (!ranking) return <div>Loading...</div>;

  // Take the last 10 entries from position history
  const recentHistory = [...(ranking.positionHistory || [])]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6 text-gray-900">
        <h1 className="text-2xl font-bold mb-4">{ranking.keyword}</h1>
        <div className="grid gap-4">
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Current Details</h2>
            <p><span className="font-medium">URL:</span> {ranking.url}</p>
            <p><span className="font-medium">Position:</span> {ranking.position}</p>
            <p><span className="font-medium">Location:</span> {ranking.location}</p>
            <p><span className="font-medium">Country:</span> {ranking.country}</p>
            <p><span className="font-medium">Tracked Since:</span> {new Date(ranking.createdAt).toLocaleDateString()}</p>
          </div>

          <div className="border rounded p-4 overflow-x-auto">
            <h2 className="font-semibold mb-2">Position History</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">Keyword</th>
                  <th className="px-4 py-2 text-left">Location</th>
                  <th className="px-4 py-2 text-left">Country</th>
                  {recentHistory.map((history, index) => (
                    <th key={index} className="px-4 py-2">
                      {new Date(history.date).toLocaleDateString()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{ranking.keyword}</td>
                  <td className="px-4 py-2">{ranking.location}</td>
                  <td className="px-4 py-2">{ranking.country}</td>
                  {recentHistory.map((history, index) => (
                    <td key={index} className="px-4 py-2 text-center">
                      {history.position}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
```

# app/layout.jsx

```jsx
import '../styles/globals.css';
import { Footer } from '../components/footer';
import { Header } from '../components/header';

export const metadata = {
    title: {
        template: '%s | Netlify',
        default: 'Netlify Starter'
    }
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" data-theme="lofi">
            <head>
                <link rel="icon" href="/favicon.svg" sizes="any" />
            </head>
            <body className="antialiased text-white bg-blue-900">
                <div className="flex flex-col min-h-screen px-6 bg-grid-pattern sm:px-12">
                    <div className="flex flex-col w-full max-w-5xl mx-auto grow">
                        <Header />
                        <div className="grow">{children}</div>
                        <Footer />
                    </div>
                </div>
            </body>
        </html>
    );
}

```

# app/login/page.tsx

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  console.log("Loads Login Page")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      console.log('Submitting login request');
      const response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include', // Important for cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      console.log('Login response status:', response.status);
      
      const data = await response.json();
      console.log('Login response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Successful login
      console.log('Login successful, redirecting to dashboard');
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl mb-4">Login</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="mb-4">
          <label htmlFor="email" className="block mb-2">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block mb-2">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
        <div className="mt-4 text-center">
          <p>
            Dont have an account? {' '}
            <a 
              href="/register" 
              className="text-blue-500 hover:underline"
            >
              Register here
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
```

# app/page.jsx

```jsx
import Link from 'next/link';
import { Card } from 'components/card';
import { RandomQuote } from 'components/random-quote';
import { Markdown } from 'components/markdown';
import { ContextAlert } from 'components/context-alert';
import { getNetlifyContext } from 'utils';

const cards = [
    //{ text: 'Hello', linkText: 'someLink', href: '/' }
];

const contextExplainer = `
The card below is rendered on the server based on the value of \`process.env.CONTEXT\` 
([docs](https://docs.netlify.com/configure-builds/environment-variables/#build-metadata)):
`;

const preDynamicContentExplainer = `
The card content below is fetched by the client-side from \`/quotes/random\` (see file \`app/quotes/random/route.js\`) with a different quote shown on each page load:
`;

const postDynamicContentExplainer = `
On Netlify, Next.js Route Handlers are automatically deployed as [Serverless Functions](https://docs.netlify.com/functions/overview/).
Alternatively, you can add Serverless Functions to any site regardless of framework, with acccess to the [full context data](https://docs.netlify.com/functions/api/).

And as always with dynamic content, beware of layout shifts & flicker! (here, we aren't...)
`;

const ctx = getNetlifyContext();

export default function Page() {
    return (
        <main className="flex flex-col gap-8 sm:gap-16">
            <section className="flex flex-col items-start gap-3 sm:gap-4">
                <ContextAlert />
                <h1 className="mb-0">Ya Boi</h1>
                <p className="text-lg">This is Sebas sandbox</p>
                <Link
                    href="https://docs.netlify.com/frameworks/next-js/overview/"
                    className="btn btn-lg btn-primary sm:btn-wide"
                >
                    Read the Docs
                </Link>
            </section>
            {!!ctx && (
                <section className="flex flex-col gap-4">
                    <Markdown content={contextExplainer} />
                    <RuntimeContextCard />
                </section>
            )}
            <section className="flex flex-col gap-4">
                <Markdown content={preDynamicContentExplainer} />
                <RandomQuote />
                <Markdown content={postDynamicContentExplainer} />
            </section>
            {/* !!cards?.length && <CardsGrid cards={cards} /> */}
        </main>
    );
}

function RuntimeContextCard() {
    const title = `Netlify Context: running in ${ctx} mode.`;
    if (ctx === 'dev') {
        return <Card title={title} text="Next.js will rebuild any page you navigate to, including static pages." />;
    } else {
        return <Card title={title} text="This page was statically-generated at build time." />;
    }
}

```

# app/quotes/random/route.js

```js
import { NextResponse } from 'next/server';
import data from 'data/quotes.json';

export const dynamic = 'force-dynamic'; // Otherwise, Next.js will cache this handler's output

const dataSource = 'https://en.wikipedia.org/wiki/AFI%27s_100_Years...100_Movie_Quotes';

export async function GET() {
    const randomId = Math.floor(Math.random() * data.length);
    const item = data[randomId];
    
    return NextResponse.json({
        ...item,
        dataSource
    });
}

```

# app/register/page.tsx

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Redirect to login or dashboard
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <>
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl mb-4">Register</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="mb-4">
          <label htmlFor="email" className="block mb-2">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block mb-2">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <button 
          type="submit" 
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Register
        </button>
      </form>
    </div>
    </>);
}
```

# app/revalidation/page.jsx

```jsx
import { revalidateTag } from 'next/cache';
import { SubmitButton } from '../../components/submit-button';
import { Markdown } from '../../components/markdown';

export const metadata = {
    title: 'On-Demand Revalidation'
};

const tagName = 'randomWiki';
const randomWikiUrl = 'https://en.wikipedia.org/api/rest_v1/page/random/summary';
const maxExtractLength = 200;
const revalidateTTL = 60;

const explainer = `
This page perfoms a \`fetch\` on the server to get a random article from Wikipedia. 
The fetched data is then cached with a tag named "${tagName}" and a maximum age of ${revalidateTTL} seconds.

~~~jsx
const url = 'https://en.wikipedia.org/api/rest_v1/page/random/summary';

async function RandomArticleComponent() {
    const randomArticle = await fetch(url, {
        next: { revalidate: ${revalidateTTL}, tags: ['${tagName}'] }
    });
    // ...render
}
~~~

After the set time has passed, the first request for this page would trigger its rebuild in the background. When the new page is ready, subsequent requests would return the new page - 
see [\`stale-white-revalidate\`](https://www.netlify.com/blog/swr-and-fine-grained-cache-control/).

Alternatively, if the cache tag is explicitly invalidated by \`revalidateTag('${tagName}')\`, any page using that tag would be rebuilt in the background when requested.

In real-life applications, tags are typically invalidated when data has changed in an external system (e.g., the CMS notifies the site about content changes via a webhook), or after a data mutation made through the site.

For this functionality to work, Next.js uses the [fine-grained caching headers](https://docs.netlify.com/platform/caching/) available on Netlify - but you can use these features on basically any Netlify site!
`;


export default async function Page() {
    async function revalidateWiki() {
        'use server';
        revalidateTag(tagName);
    }

    return (
        <>
            <h1>Revalidation Basics</h1>
            <Markdown content={explainer} />
            <form className="mt-4" action={revalidateWiki}>
                <SubmitButton text="Click to Revalidate" />
            </form>
            <RandomWikiArticle />
        </>
    );
}

async function RandomWikiArticle() {
    const randomWiki = await fetch(randomWikiUrl, {
        next: { revalidate: revalidateTTL, tags: [tagName] }
    });

    const content = await randomWiki.json();
    let extract = content.extract;
    if (extract.length > maxExtractLength) {
        extract = extract.slice(0, extract.slice(0, maxExtractLength).lastIndexOf(' ')) + ' [...]';
    }

    return (
        <div className="bg-white text-neutral-600 card my-6 max-w-2xl">
            <div className="card-title text-3xl px-8 pt-8">{content.title}</div>
            <div className="card-body py-4">
                <div className="text-lg font-bold">{content.description}</div>
                <p className="italic">{extract}</p>
                <a target="_blank" rel="noopener noreferrer" href={content.content_urls.desktop.page}>
                    From Wikipedia
                </a>
            </div>
        </div>
    );
}

```

# app/seo/page.jsx

```jsx
import { FeedbackForm } from 'components/feedback-form';
import { Markdown } from '../../components/markdown';
import { KeywordRankingForm } from '@/app/keyword-ranking-form'; // Adjust import path as needed

export const metadata = {
    title: 'SEO Tools'
};

const explainer = `
I'm using this environment as a sandbox to try out potential SEO tools.
`;

export default async function Page() {
    return (
        <>
            <h1>SEO Tools</h1>
            <Markdown content={explainer} />
            <div className="flex w-full pt-12 justify-center">
                <div className="w-full max-w-xl space-y-6">
                    <KeywordRankingForm />
                    <FeedbackForm />
                </div>
            </div>
        </>
    );
}
```

# components/alert.jsx

```jsx
export function Alert({ children, className }) {
    return (
        <div className={['alert alert-info', className].join(' ')}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12 20.016q3.281 0 5.648-2.367t2.367-5.648-2.367-5.648-5.648-2.367-5.648 2.367-2.367 5.648 2.367 5.648 5.648 2.367zM12 2.016q4.125 0 7.055 2.93t2.93 7.055-2.93 7.055-7.055 2.93-7.055-2.93-2.93-7.055 2.93-7.055 7.055-2.93zM11.016 6.984h1.969v6h-1.969v-6zM11.016 15h1.969v2.016h-1.969v-2.016z"></path>
            </svg>
            {children}
        </div>
    );
}

```

# components/card.jsx

```jsx
import Link from 'next/link';

export function Card({ title, text, linkText, href, children }) {
    return (
        <div className="bg-white text-neutral-600 card">
            <div className="card-body">
                {title && <h3 className="text-neutral-900 card-title">{title}</h3>}
                {text && <p>{text}</p>}
                {linkText && href && (
                    <div className="card-actions">
                        <Link href={href} className="transition link text-neutral-900 hover:opacity-80">
                            {linkText}
                        </Link>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

```

# components/cards-grid.jsx

```jsx
import { Card } from './card';

export function CardsGrid({ cards }) {
    return <section className="grid gap-6 sm:grid-cols-3">{!!cards?.length && cards.map((card, index) => <Card key={index} {...card} />)}</section>;
}

```

# components/code-block.jsx

```jsx
import { Code } from 'bright';

export function CodeBlock({ code, lang, lineNumbers, title }) {
    return (
        <Code lang={lang} title={title} lineNumbers={lineNumbers} theme="poimandres">
            {code}
        </Code>
    );
}
```

# components/context-alert.jsx

```jsx
import { getNetlifyContext } from 'utils';
import { Alert } from './alert';
import { Markdown } from './markdown';

const noNetlifyContextAlert = `
For full functionality, either run this site locally via \`netlify dev\`
([see docs](https://docs.netlify.com/cli/local-development/")) or deploy it to Netlify.
`;

export function ContextAlert(props) {
    const { addedChecksFunction } = props;
    const ctx = getNetlifyContext();

    let markdownText = null;
    if (!ctx) {
        markdownText = noNetlifyContextAlert;
    } else if (addedChecksFunction) {
        markdownText = addedChecksFunction(ctx);
    }

    if (markdownText) {
        return (
            <Alert>
                <Markdown content={markdownText} />
            </Alert>
        );
    } else {
        return <></>;
    }
}

```

# components/country-flag.tsx

```tsx
import React from 'react';

const countryFlags = {
  US: '🇺🇸',
  PE: '🇵🇪',
  Global: '🌎',
  // Add more country codes as needed
};

export function Country({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center">
      {countryFlags[code] || ''}
    </span>
  );
}
```

# components/feedback-form.jsx

```jsx
'use client';

import { useState } from 'react';
import { Card } from './card';

export function FeedbackForm() {
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        try {
            setStatus('pending');
            setError(null);
            const myForm = event.target;
            const formData = new FormData(myForm);
            const res = await fetch('/__forms.html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData).toString()
            });
            if (res.status === 200) {
                setStatus('ok');
            } else {
                setStatus('error');
                setError(`${res.status} ${res.statusText}`);
            }
        } catch (e) {
            setStatus('error');
            setError(`${e}`);
        }
    };

    return (
        <div className="w-full md:max-w-md">
            <Card title="Leave Feedback">
                <form
                    name="feedback"
                    onSubmit={handleFormSubmit}
                    className="text-black flex flex-col gap-3 align-center"
                >
                    <input type="hidden" name="form-name" value="feedback" />
                    <input name="name" type="text" placeholder="Name" required className="input input-bordered" />
                    <input name="email" type="text" placeholder="Email (optional)" className="input input-bordered" />
                    <input name="message" type="text" placeholder="Message" required className="input input-bordered" />
                    <button className="btn btn-primary" type="submit" disabled={status === 'pending'}>
                        Submit
                    </button>
                    {status === 'ok' && (
                        <div className="alert alert-success">
                            <SuccessIcon />
                            Submitted!
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="alert alert-error">
                            <ErrorIcon />
                            {error}
                        </div>
                    )}
                </form>
            </Card>
        </div>
    );
}

function SuccessIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    );
}
function ErrorIcon(success) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    );
}

```

# components/footer.jsx

```jsx
import Link from 'next/link';

export function Footer() {
    return (
        <footer className="pt-16 pb-12 sm:pt-24 sm:pb-16">
            <p className="text-sm">
                <Link href="https://docs.netlify.com/frameworks/next-js/overview/" className="underline transition decoration-dashed text-primary underline-offset-8 hover:opacity-80">
                    Next.js on Netlify
                </Link>
            </p>
        </footer>
    );
};

```

# components/header.jsx

```jsx
import Image from 'next/image';
import Link from 'next/link';
import netlifyLogo from 'public/netlify-logo.svg';
import githubLogo from 'public/images/github-mark-white.svg';

const navItems = [
    { linkText: 'Home', href: '/' },
    { linkText: 'Revalidation', href: '/revalidation' },
    { linkText: 'Image CDN', href: '/image-cdn' },
    { linkText: 'Edge Function', href: '/edge' },
    { linkText: 'Blobs', href: '/blobs' },
    { linkText: 'Classics', href: '/classics' }
];

export function Header() {
    return (
        <nav className="flex flex-wrap items-center gap-4 pt-6 pb-12 sm:pt-12 md:pb-24">
            <Link href="/">
                <Image src={netlifyLogo} alt="Netlify logo" />
            </Link>
            {!!navItems?.length && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {navItems.map((item, index) => (
                        <li key={index}>
                            <Link
                                href={item.href}
                                className="inline-block px-1.5 py-1 transition hover:opacity-80 sm:px-3 sm:py-2"
                            >
                                {item.linkText}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex-grow justify-end hidden lg:flex lg:mr-1">
                <Link
                    href="https://github.com/netlify-templates/next-platform-starter"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Image src={githubLogo} alt="GitHub logo" className="w-7" />
                </Link>
            </div>
        </nav>
    );
}

```

# components/markdown.jsx

```jsx
import MarkdownToJsx from 'markdown-to-jsx';
import { CodeBlock } from './code-block';

export function Markdown({ content }) {
    const HighlightedCodeBlock = ({ children }) => {
        const { props } = children;
        const matchLanguage = /lang-(\w+)/.exec(props?.className || '');
        return <CodeBlock code={props?.children} lang={matchLanguage ? matchLanguage[1] : undefined} title={props?.title} />;
    };

    return (
        <MarkdownToJsx
            className="markdown"
            options={{
                overrides: {
                    pre: HighlightedCodeBlock
                }
            }}
        >
            {content}
        </MarkdownToJsx>
    );
}

```

# components/random-quote.jsx

```jsx
'use client';

import { useEffect, useState } from 'react';

const randomQuoteUrl = '/quotes/random';

export function RandomQuote() {
    const [quote, setQuote] = useState(null);
    const [time, setTime] = useState(null);

    useEffect(() => {
        const fetchQuote = async () => {
            try {
                const response = await fetch(randomQuoteUrl, { cache: 'no-store' });
                if (response) {
                    const data = await response.json();
                    setQuote(data);
                    setTime(new Date().toLocaleString());
                }
            } catch (error) {
                console.log(error);
            }
        };
        fetchQuote();
    }, []);

    return (
        <div className="bg-white card text-neutral-600">
            <div className="card-body">
                {quote ? (
                    <>
                        <h3 className="text-xl text-neutral-900 font-bold">&ldquo;{quote.text}&rdquo;</h3>
                        <p>
                            {' '}
                            - {quote.playedBy} as {quote.character} in &ldquo;{quote.film}&rdquo; ({quote.year})
                        </p>
                        <p className="pt-2.5 mt-2.5 border-t border-dashed text-secondary border-neutral-200">
                            <span className="text-sm italic">
                                loaded at {time}. <a href={quote.dataSource}>Original data source.</a>
                            </span>
                        </p>
                    </>
                ) : (
                    <div className="card-body">Loading...</div>
                )}
            </div>
        </div>
    );
}

```

# components/rankings-table.tsx

```tsx
import { IRanking } from "models/Ranking";
import Link from "next/link";
import { Country } from "./country-flag";

export function RankingsTable({ rankings }: { rankings: IRanking[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracked Since</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rankings.map((ranking) => (
            <tr key={ranking._id.toString()} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <Link href={`/keyword/${ranking._id}`} className="text-blue-500 hover:underline">
                  {ranking.keyword}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500">
                <a href={ranking.linkUrl || ranking.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {ranking.url}
                </a>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ranking.position ?? 'Pending'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {ranking.location && ranking.country !== 'Global' ? (
                  <div className="flex items-center gap-2">
                    <Country code={ranking.country} />
                    {ranking.location}
                  </div>
                ) : (
                  'Global'
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(ranking.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

# components/submit-button.jsx

```jsx
'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ text = 'Submit' }) {
    const { pending } = useFormStatus();
    return (
        <button className="btn btn-md btn-primary" type="submit" disabled={pending}>
            {text}
        </button>
    );
}

```

# data/quotes.json

```json
[
    {
      "text": "Frankly, my dear, I don't give a damn.",
      "character": "Rhett Butler",
      "playedBy": "Clark Gable",
      "film": "Gone with the Wind",
      "year": 1939
    },
    {
      "text": "I'm gonna make him an offer he can't refuse.",
      "character": "Vito Corleone",
      "playedBy": "Marlon Brando",
      "film": "The Godfather",
      "year": 1972
    },
    {
      "text": "You don't understand! I coulda had class. I coulda been a contender. I could've been somebody, instead of a bum, which is what I am.",
      "character": "Terry Malloy",
      "playedBy": "Marlon Brando",
      "film": "On the Waterfront",
      "year": 1954
    },
    {
      "text": "Toto, I've a feeling we're not in Kansas anymore.",
      "character": "Dorothy Gale",
      "playedBy": "Judy Garland",
      "film": "The Wizard of Oz",
      "year": 1939
    },
    {
      "text": "Here's looking at you, kid.",
      "character": "Rick Blaine",
      "playedBy": "Humphrey Bogart",
      "film": "Casablanca",
      "year": 1942
    },
    {
      "text": "Go ahead, make my day.",
      "character": "Harry Callahan",
      "playedBy": "Clint Eastwood",
      "film": "Sudden Impact",
      "year": 1983
    },
    {
      "text": "All right, Mr. DeMille, I'm ready for my close-up.",
      "character": "Norma Desmond",
      "playedBy": "Gloria Swanson",
      "film": "Sunset Boulevard",
      "year": 1950
    },
    {
      "text": "May the Force be with you.",
      "character": "Han Solo",
      "playedBy": "Harrison Ford",
      "film": "Star Wars",
      "year": 1977
    },
    {
      "text": "Fasten your seatbelts. It's going to be a bumpy night.",
      "character": "Margo Channing",
      "playedBy": "Bette Davis",
      "film": "All About Eve",
      "year": 1950
    },
    {
      "text": "You talkin' to me?",
      "character": "Travis Bickle",
      "playedBy": "Robert De Niro",
      "film": "Taxi Driver",
      "year": 1976
    },
    {
      "text": "What we've got here is failure to communicate.",
      "character": "Captain",
      "playedBy": "Strother Martin",
      "film": "Cool Hand Luke",
      "year": 1967
    },
    {
      "text": "I love the smell of napalm in the morning.",
      "character": "Lt. Col. Bill Kilgore",
      "playedBy": "Robert Duvall",
      "film": "Apocalypse Now",
      "year": 1979
    },
    {
      "text": "Love means never having to say you're sorry.",
      "character": "Jennifer Cavalleri, Oliver Barrett IV",
      "playedBy": "Ali MacGraw, Ryan O'Neal",
      "film": "Love Story",
      "year": 1970
    },
    {
      "text": "The stuff that dreams are made of.",
      "character": "Sam Spade",
      "playedBy": "Humphrey Bogart",
      "film": "The Maltese Falcon",
      "year": 1941
    },
    {
      "text": "E.T. phone home.",
      "character": "E.T.",
      "playedBy": "Pat Welsh",
      "film": "E.T. the Extra-Terrestrial",
      "year": 1982
    },
    {
      "text": "They call me Mister Tibbs!",
      "character": "Virgil Tibbs",
      "playedBy": "Sidney Poitier",
      "film": "In the Heat of the Night",
      "year": 1967
    },
    {
      "text": "Rosebud.",
      "character": "Charles Foster Kane",
      "playedBy": "Orson Welles",
      "film": "Citizen Kane",
      "year": 1941
    },
    {
      "text": "Made it, Ma! Top of the world!",
      "character": "Arthur \"Cody\" Jarrett",
      "playedBy": "James Cagney",
      "film": "White Heat",
      "year": 1949
    },
    {
      "text": "I'm as mad as hell, and I'm not going to take this anymore!",
      "character": "Howard Beale",
      "playedBy": "Peter Finch",
      "film": "Network",
      "year": 1976
    },
    {
      "text": "Louis, I think this is the beginning of a beautiful friendship.",
      "character": "Rick Blaine",
      "playedBy": "Humphrey Bogart",
      "film": "Casablanca",
      "year": 1942
    },
    {
      "text": "A census taker once tried to test me. I ate his liver with some fava beans and a nice Chianti.",
      "character": "Hannibal Lecter",
      "playedBy": "Anthony Hopkins",
      "film": "The Silence of the Lambs",
      "year": 1991
    },
    {
      "text": "Bond. James Bond.",
      "character": "James Bond",
      "playedBy": "Sean Connery",
      "film": "Dr. No",
      "year": 1962
    },
    {
      "text": "There's no place like home.",
      "character": "Dorothy Gale",
      "playedBy": "Judy Garland",
      "film": "The Wizard of Oz",
      "year": 1939
    },
    {
      "text": "I am big! It's the pictures that got small.",
      "character": "Norma Desmond",
      "playedBy": "Gloria Swanson",
      "film": "Sunset Boulevard",
      "year": 1950
    },
    {
      "text": "Show me the money!",
      "character": "Rod Tidwell",
      "playedBy": "Cuba Gooding Jr.",
      "film": "Jerry Maguire",
      "year": 1996
    },
    {
      "text": "Why don't you come up sometime and see me?",
      "character": "Lady Lou",
      "playedBy": "Mae West",
      "film": "She Done Him Wrong",
      "year": 1933
    },
    {
      "text": "I'm walkin' here! I'm walkin' here!",
      "character": "Ratso\" Rizzo",
      "playedBy": "Dustin Hoffman",
      "film": "Midnight Cowboy",
      "year": 1969
    },
    {
      "text": "Play it, Sam. Play 'As Time Goes By.'",
      "character": "Ilsa Lund",
      "playedBy": "Ingrid Bergman",
      "film": "Casablanca",
      "year": 1942
    },
    {
      "text": "You can't handle the truth!",
      "character": "Col. Nathan R. Jessup",
      "playedBy": "Jack Nicholson",
      "film": "A Few Good Men",
      "year": 1992
    },
    {
      "text": "I want to be alone.",
      "character": "Grusinskaya",
      "playedBy": "Greta Garbo",
      "film": "Grand Hotel",
      "year": 1932
    },
    {
      "text": "After all, tomorrow is another day!",
      "character": "Scarlett O'Hara",
      "playedBy": "Vivien Leigh",
      "film": "Gone with the Wind",
      "year": 1939
    },
    {
      "text": "Round up the usual suspects.",
      "character": "Capt. Louis Renault",
      "playedBy": "Claude Rains",
      "film": "Casablanca",
      "year": 1942
    },
    {
      "text": "I'll have what she's having.",
      "character": "Customer",
      "playedBy": "Estelle Reiner",
      "film": "When Harry Met Sally...",
      "year": 1989
    },
    {
      "text": "You know how to whistle, don't you, Steve? You just put your lips together and blow.",
      "character": "Marie \"Slim\" Browning",
      "playedBy": "Lauren Bacall",
      "film": "To Have and Have Not",
      "year": 1944
    },
    {
      "text": "You're gonna need a bigger boat.",
      "character": "Martin Brody",
      "playedBy": "Roy Scheider",
      "film": "Jaws",
      "year": 1975
    },
    {
      "text": "Badges? We ain't got no badges! We don't need no badges! I don't have to show you any stinking badges!",
      "character": "Gold Hat",
      "playedBy": "Alfonso Bedoya",
      "film": "The Treasure of the Sierra Madre",
      "year": 1948
    },
    {
      "text": "I'll be back.",
      "character": "The Terminator",
      "playedBy": "Arnold Schwarzenegger",
      "film": "The Terminator",
      "year": 1984
    },
    {
      "text": "Today, I consider myself the luckiest man on the face of the Earth.",
      "character": "Lou Gehrig",
      "playedBy": "Gary Cooper",
      "film": "The Pride of the Yankees",
      "year": 1942
    },
    {
      "text": "If you build it, he will come.",
      "character": "Shoeless Joe Jackson",
      "playedBy": "Ray Liotta (voice)",
      "film": "Field of Dreams",
      "year": 1989
    },
    {
      "text": "My mama always said life was like a box of chocolates. You never know what you're gonna get.",
      "character": "Forrest Gump",
      "playedBy": "Tom Hanks",
      "film": "Forrest Gump",
      "year": 1994
    },
    {
      "text": "We rob banks.",
      "character": "Clyde Barrow",
      "playedBy": "Warren Beatty",
      "film": "Bonnie and Clyde",
      "year": 1967
    },
    {
      "text": "Plastics.",
      "character": "Mr. Maguire",
      "playedBy": "Walter Brooke",
      "film": "The Graduate",
      "year": 1967
    },
    {
      "text": "We'll always have Paris.",
      "character": "Rick Blaine",
      "playedBy": "Humphrey Bogart",
      "film": "Casablanca",
      "year": 1942
    },
    {
      "text": "I see dead people.",
      "character": "Cole Sear",
      "playedBy": "Haley Joel Osment",
      "film": "The Sixth Sense",
      "year": 1999
    },
    {
      "text": "Stella! Hey, Stella!",
      "character": "Stanley Kowalski",
      "playedBy": "Marlon Brando",
      "film": "A Streetcar Named Desire",
      "year": 1951
    },
    {
      "text": "Oh, Jerry, don't let's ask for the moon. We have the stars.",
      "character": "Charlotte Vale",
      "playedBy": "Bette Davis",
      "film": "Now, Voyager",
      "year": 1942
    },
    {
      "text": "Shane. Shane. Come back!",
      "character": "Joey Starrett",
      "playedBy": "Brandon De Wilde",
      "film": "Shane",
      "year": 1953
    },
    {
      "text": "Well, nobody's perfect.",
      "character": "Osgood Fielding III",
      "playedBy": "Joe E. Brown",
      "film": "Some Like It Hot",
      "year": 1959
    },
    {
      "text": "It's alive! It's alive!",
      "character": "Henry Frankenstein",
      "playedBy": "Colin Clive",
      "film": "Frankenstein",
      "year": 1931
    },
    {
      "text": "Houston, we have a problem.",
      "character": "Jim Lovell",
      "playedBy": "Tom Hanks",
      "film": "Apollo 13",
      "year": 1995
    },
    {
      "text": "You've got to ask yourself one question: 'Do I feel lucky?' Well, do ya, punk?",
      "character": "Harry Callahan",
      "playedBy": "Clint Eastwood",
      "film": "Dirty Harry",
      "year": 1971
    },
    {
      "text": "You had me at 'hello.'",
      "character": "Dorothy Boyd",
      "playedBy": "Renée Zellweger",
      "film": "Jerry Maguire",
      "year": 1996
    },
    {
      "text": "One morning I shot an elephant in my pajamas. How he got in my pajamas, I don't know.",
      "character": "Capt. Geoffrey T. Spaulding",
      "playedBy": "Groucho Marx",
      "film": "Animal Crackers",
      "year": 1930
    },
    {
      "text": "There's no crying in baseball!",
      "character": "Jimmy Dugan",
      "playedBy": "Tom Hanks",
      "film": "A League of Their Own",
      "year": 1992
    },
    {
      "text": "La-dee-da, la-dee-da.",
      "character": "Annie Hall",
      "playedBy": "Diane Keaton",
      "film": "Annie Hall",
      "year": 1977
    },
    {
      "text": "A boy's best friend is his mother.",
      "character": "Norman Bates",
      "playedBy": "Anthony Perkins",
      "film": "Psycho",
      "year": 1960
    },
    {
      "text": "Greed, for lack of a better word, is good.",
      "character": "Gordon Gekko",
      "playedBy": "Michael Douglas",
      "film": "Wall Street",
      "year": 1987
    },
    {
      "text": "Keep your friends close, but your enemies closer.",
      "character": "Michael Corleone",
      "playedBy": "Al Pacino",
      "film": "The Godfather Part II",
      "year": 1974
    },
    {
      "text": "As God is my witness, I'll never be hungry again.",
      "character": "Scarlett O'Hara",
      "playedBy": "Vivien Leigh",
      "film": "Gone with the Wind",
      "year": 1939
    },
    {
      "text": "Well, here's another nice mess you've gotten me into!",
      "character": "Oliver",
      "playedBy": "Oliver Hardy",
      "film": "Sons of the Desert",
      "year": 1933
    },
    {
      "text": "Say 'hello' to my little friend!",
      "character": "Tony Montana",
      "playedBy": "Al Pacino",
      "film": "Scarface",
      "year": 1983
    },
    {
      "text": "What a dump.",
      "character": "Rosa Moline",
      "playedBy": "Bette Davis",
      "film": "Beyond the Forest",
      "year": 1949
    },
    {
      "text": "Mrs. Robinson, you're trying to seduce me. Aren't you?",
      "character": "Benjamin Braddock",
      "playedBy": "Dustin Hoffman",
      "film": "The Graduate",
      "year": 1967
    },
    {
      "text": "Gentlemen, you can't fight in here! This is the War Room!",
      "character": "President Merkin Muffley",
      "playedBy": "Peter Sellers",
      "film": "Dr. Strangelove",
      "year": 1964
    },
    {
      "text": "Elementary, my dear Watson.",
      "character": "Sherlock Holmes",
      "playedBy": "Basil Rathbone",
      "film": "The Adventures of Sherlock Holmes",
      "year": 1939
    },
    {
      "text": "Take your stinking paws off me, you damned dirty ape.",
      "character": "George Taylor",
      "playedBy": "Charlton Heston",
      "film": "Planet of the Apes",
      "year": 1968
    },
    {
      "text": "Of all the gin joints in all the towns in all the world, she walks into mine.",
      "character": "Rick Blaine",
      "playedBy": "Humphrey Bogart",
      "film": "Casablanca",
      "year": 1942
    },
    {
      "text": "Here's Johnny!",
      "character": "Jack Torrance",
      "playedBy": "Jack Nicholson",
      "film": "The Shining",
      "year": 1980
    },
    {
      "text": "They're here!",
      "character": "Carol Anne Freeling",
      "playedBy": "Heather O'Rourke",
      "film": "Poltergeist",
      "year": 1982
    },
    {
      "text": "Is it safe?",
      "character": "Dr. Christian Szell",
      "playedBy": "Laurence Olivier",
      "film": "Marathon Man",
      "year": 1976
    },
    {
      "text": "Wait a minute, wait a minute. You ain't heard nothin' yet!",
      "character": "Jakie Rabinowitz/Jack Robin",
      "playedBy": "Al Jolson",
      "film": "The Jazz Singer",
      "year": 1927
    },
    {
      "text": "No wire hangers, ever!",
      "character": "Joan Crawford",
      "playedBy": "Faye Dunaway",
      "film": "Mommie Dearest",
      "year": 1981
    },
    {
      "text": "Mother of mercy, is this the end of Rico?",
      "character": "Rico Bandello",
      "playedBy": "Edward G. Robinson",
      "film": "Little Caesar",
      "year": 1931
    },
    {
      "text": "Forget it, Jake, it's Chinatown.",
      "character": "Lawrence Walsh",
      "playedBy": "Joe Mantell",
      "film": "Chinatown",
      "year": 1974
    },
    {
      "text": "I have always depended on the kindness of strangers.",
      "character": "Blanche DuBois",
      "playedBy": "Vivien Leigh",
      "film": "A Streetcar Named Desire",
      "year": 1951
    },
    {
      "text": "Hasta la vista, baby.",
      "character": "The Terminator",
      "playedBy": "Arnold Schwarzenegger",
      "film": "Terminator 2: Judgment Day",
      "year": 1991
    },
    {
      "text": "Soylent Green is people!",
      "character": "Det. Robert Thorn",
      "playedBy": "Charlton Heston",
      "film": "Soylent Green",
      "year": 1973
    },
    {
      "text": "Open the pod bay doors, HAL.",
      "character": "Dave Bowman",
      "playedBy": "Keir Dullea",
      "film": "2001: A Space Odyssey",
      "year": 1968
    },
    {
      "text": "Striker: \"Surely you can't be serious.\"\nRumack: \"I am serious … and don't call me Shirley.",
      "character": "Ted Striker and Dr. Rumack",
      "playedBy": "Robert Hays and Leslie Nielsen",
      "film": "Airplane!",
      "year": 1980
    },
    {
      "text": "Yo, Adrian!",
      "character": "Rocky Balboa",
      "playedBy": "Sylvester Stallone",
      "film": "Rocky",
      "year": 1976
    },
    {
      "text": "Hello, gorgeous.",
      "character": "Fanny Brice",
      "playedBy": "Barbra Streisand",
      "film": "Funny Girl",
      "year": 1968
    },
    {
      "text": "Toga! Toga!",
      "character": "John \"Bluto\" Blutarsky",
      "playedBy": "John Belushi",
      "film": "National Lampoon's Animal House",
      "year": 1978
    },
    {
      "text": "Listen to them. Children of the night. What music they make.",
      "character": "Count Dracula",
      "playedBy": "Bela Lugosi",
      "film": "Dracula",
      "year": 1931
    },
    {
      "text": "Oh, no, it wasn't the airplanes. It was Beauty killed the Beast.",
      "character": "Carl Denham",
      "playedBy": "Robert Armstrong",
      "film": "King Kong",
      "year": 1933
    },
    {
      "text": "My precious.",
      "character": "Gollum",
      "playedBy": "Andy Serkis",
      "film": "The Lord of the Rings: The Two Towers",
      "year": 2002
    },
    {
      "text": "Attica! Attica!",
      "character": "Sonny Wortzik",
      "playedBy": "Al Pacino",
      "film": "Dog Day Afternoon",
      "year": 1975
    },
    {
      "text": "Sawyer, you're going out a youngster, but you've got to come back a star!",
      "character": "Julian Marsh",
      "playedBy": "Warner Baxter",
      "film": "42nd Street",
      "year": 1933
    },
    {
      "text": "Listen to me, mister. You're my knight in shining armor. Don't you forget it. You're going to get back on that horse, and I'm going to be right behind you, holding on tight, and away we're gonna go, go, go!",
      "character": "Ethel Thayer",
      "playedBy": "Katharine Hepburn",
      "film": "On Golden Pond",
      "year": 1981
    },
    {
      "text": "Tell 'em to go out there with all they got and win just one for the Gipper.",
      "character": "George Gipp",
      "playedBy": "Ronald Reagan",
      "film": "Knute Rockne, All American",
      "year": 1940
    },
    {
      "text": "A martini. Shaken, not stirred.",
      "character": "James Bond",
      "playedBy": "Sean Connery",
      "film": "Goldfinger[aa]",
      "year": 1964
    },
    {
      "text": "Who's on first.\"[ab]",
      "character": "Dexter",
      "playedBy": "Bud Abbott",
      "film": "The Naughty Nineties",
      "year": 1945
    },
    {
      "text": "Cinderella story. Outta nowhere. A former greenskeeper, now, about to become the Masters champion. It looks like a mirac...It's in the hole! It's in the hole! It's in the hole!",
      "character": "Carl Spackler",
      "playedBy": "Bill Murray",
      "film": "Caddyshack",
      "year": 1980
    },
    {
      "text": "Life is a banquet, and most poor suckers are starving to death!",
      "character": "Mame Dennis",
      "playedBy": "Rosalind Russell",
      "film": "Auntie Mame",
      "year": 1958
    },
    {
      "text": "I feel the need—the need for speed!",
      "character": "Pete Mitchell and Nick Bradshaw",
      "playedBy": "Tom Cruise and Anthony Edwards",
      "film": "Top Gun",
      "year": 1986
    },
    {
      "text": "Carpe diem. Seize the day, boys. Make your lives extraordinary.",
      "character": "John Keating",
      "playedBy": "Robin Williams",
      "film": "Dead Poets Society",
      "year": 1989
    },
    {
      "text": "Snap out of it!",
      "character": "Loretta Castorini",
      "playedBy": "Cher",
      "film": "Moonstruck",
      "year": 1987
    },
    {
      "text": "My mother thanks you. My father thanks you. My sister thanks you. And I thank you.",
      "character": "George M. Cohan",
      "playedBy": "James Cagney",
      "film": "Yankee Doodle Dandy",
      "year": 1942
    },
    {
      "text": "Nobody puts Baby in a corner.",
      "character": "Johnny Castle",
      "playedBy": "Patrick Swayze",
      "film": "Dirty Dancing",
      "year": 1987
    },
    {
      "text": "I'll get you, my pretty, and your little dog too!",
      "character": "Wicked Witch of the West",
      "playedBy": "Margaret Hamilton",
      "film": "The Wizard of Oz",
      "year": 1939
    },
    {
      "text": "I'm the king of the world!",
      "character": "Jack Dawson",
      "playedBy": "Leonardo DiCaprio",
      "film": "Titanic",
      "year": 1997
    }
  ]
```

# jsconfig.json

```json
{ 
    "compilerOptions": {
        "baseUrl": "."
      }    
}
```

# middleware.ts

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken';
import { verifyToken } from 'utils/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  // List of paths that don't require authentication
  const publicPaths = ['/login', '/register', '/api/login', '/api/register'];

  // Check if the current path requires authentication
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  // If no token and path requires auth, redirect to login
  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token if present
  // if (token) {
  //   try {
  //     jwt.verify(token, process.env.JWT_SECRET!);
  //   } catch (error) {
  //     // Invalid token, clear cookie and redirect to login
  //     const response = NextResponse.redirect(new URL('/login', request.url));
  //     response.cookies.delete('token');
  //     return response;
  //   }
  // }
    // Verify token if present
    if (token) {
      const tokenData = await verifyToken(token);
      if (!tokenData) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('token');
        return response;
      }
    }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

# models/Ranking.ts

```ts
import mongoose from 'mongoose';

interface PositionHistory {
  position: number;
  date: Date;
}

export interface IRanking extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  url: string;
  keyword: string;
  location: string;  // New field
  country: string;   // New field
  position: number | null;
  title?: string;
  linkUrl?: string;
  createdAt: Date;
  positionHistory: PositionHistory[];
}

const RankingSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    url: String,
    keyword: String,
    location: {        // New field
      type: String,
      default: 'Global'
    },
    country: {         // New field
      type: String,
      default: 'Global'
    },
    position: Number,
    title: String,
    linkUrl: String,
    positionHistory: {
      type: [{
        position: { type: Number, required: true },
        date: { type: Date, default: Date.now }
      }],
      default: [{ position: 0, date: new Date() }]
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
});

export const Ranking = mongoose.models.Ranking || mongoose.model<IRanking>('Ranking', RankingSchema);
```

# models/User.ts

```ts
import mongoose from 'mongoose';

export interface IUser extends mongoose.Document {
  email: string;
  password: string;
  createdAt: Date;
}

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
```

# netlify.toml

```toml
[build]
  publish = ".next"
  command = "npm run build"
```

# netlify/edge-functions/rewrite.js

```js
const rewrite = async (request, context) => {
    const path = context.geo?.country?.code === 'AU' ? '/edge/australia' : '/edge/not-australia';
    return new URL(path, request.url);
};

export const config = {
    path: '/edge'
};

export default rewrite;

```

# next-env.d.ts

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.

```

# next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        SERPAPI_KEY: process.env.SERPAPI_KEY
      }
};

module.exports = nextConfig;

```

# package.json

```json
{
    "name": "next-netlify-platform-starter",
    "version": "0.1.0",
    "private": true,
    "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "next start",
        "lint": "next lint"
    },
    "dependencies": {
        "@netlify/blobs": "^8.1.0",
        "@radix-ui/react-slot": "^1.1.0",
        "axios": "^1.7.8",
        "bcryptjs": "^2.4.3",
        "blobshape": "^1.0.0",
        "bright": "^0.8.5",
        "class-variance-authority": "^0.7.1",
        "clsx": "^2.1.1",
        "jose": "^5.9.6",
        "jsonwebtoken": "^9.0.2",
        "markdown-to-jsx": "^7.4.5",
        "mongoose": "^8.8.3",
        "next": "14.1.0",
        "react": "18.3.1",
        "react-dom": "18.3.1",
        "recharts": "^2.13.3",
        "shadcn-ui": "^0.9.3",
        "tailwind-merge": "^2.5.5",
        "tailwindcss-animate": "^1.0.7",
        "unique-names-generator": "^4.7.1"
    },
    "devDependencies": {
        "@types/node": "22.10.0",
        "@types/react": "18.3.12",
        "autoprefixer": "^10.4.18",
        "daisyui": "^4.12.8",
        "eslint": "8.57.1",
        "eslint-config-next": "15.0.3",
        "postcss": "^8.4.36",
        "tailwindcss": "^3.4.1"
    }
}

```

# postcss.config.js

```js
module.exports = {
    plugins: {
        tailwindcss: {},
        autoprefixer: {}
    }
};

```

# public/__forms.html

```html
<html>
    <head></head>
    <body>
        <form name="feedback" data-netlify="true" hidden>
            <input type="hidden" name="form-name" value="feedback" />
            <input name="name" type="text" />
            <input name="email" type="text" />
            <input name="message" type="text" />
        </form>
    </body>
</html>
```

# public/favicon.svg

This is a file of the type: SVG Image

# public/images/corgi.jpg

This is a binary file of the type: Image

# public/images/github-mark-white.svg

This is a file of the type: SVG Image

# public/images/grid-bg.svg

This is a file of the type: SVG Image

# public/images/noise.png

This is a binary file of the type: Image

# public/images/noise.svg

This is a file of the type: SVG Image

# public/netlify-logo.svg

This is a file of the type: SVG Image

# README.md

```md
# Next.js on Netlify Platform Starter

[Live Demo](https://nextjs-platform-starter.netlify.app/)

A modern starter based on Next.js 14 (App Router), Tailwind, daisyUI, and [Netlify Core Primitives](https://docs.netlify.com/core/overview/#develop) (Edge Functions, Image CDN, Blob Store).

In this site, Netlify Core Primitives are used both implictly for running Next.js features (e.g. Route Handlers, image optimization via `next/image`, and more) and also explicitly by the user code. 

Implicit usage means you're using any Next.js functionality and everything "just works" when deployed - all the plumbing is done for you. Explicit usage is framework-agnostic and typically provides more features than what Next.js exposes.

## Deploying to Netlify

This site requires [Netlify Next Runtime v5](https://docs.netlify.com/frameworks/next-js/overview/) for full functionality. That version is now being gradually rolled out to all Netlify accounts. 

After deploying via the button below, please visit the **Site Overview** page for your new site to check whether it is already using the v5 runtime. If not, you'll be prompted to opt-in to to v5.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/netlify-templates/next-platform-starter)

## Developing Locally

1. Clone this repository, then run `npm install` in its root directory.

2. For the starter to have full functionality locally (e.g. edge functions, blob store), please ensure you have an up-to-date version of Netlify CLI. Run:

\`\`\`
npm install netlify-cli@latest -g
\`\`\`

3. Link your local repository to the deployed Netlify site. This will ensure you're using the same runtime version for both local development and your deployed site.

\`\`\`
netlify link
\`\`\`

4. Then, run the Next.js development server via Netlify CLI:

\`\`\`
netlify dev
\`\`\`

If your browser doesn't navigate to the site automatically, visit [localhost:8888](http://localhost:8888).



```

# renovate.json

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "local>netlify-templates/renovate-config"
  ]
}

```

# styles/globals.css

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :not(pre) > code {
        @apply px-1 py-0.5 font-mono rounded bg-neutral-900 text-yellow-200;
        font-size: 0.9em;
    }

    h1 {
        @apply mb-6 text-4xl font-bold tracking-tight md:text-5xl;
    }
}

a {
    @apply underline
}

.markdown {
    @apply mb-1;
}

.alert .markdown {
    @apply mb-0;
}

.markdown p {
    @apply mb-3;
}

.btn:disabled {
    @apply text-neutral-400 bg-neutral-700;
}
```

# tailwind.config.js

```js
const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
    content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            backgroundImage: {
                'grid-pattern': "linear-gradient(to bottom, theme('colors.neutral.950 / 0%'), theme('colors.neutral.950 / 100%')), url('/images/noise.png')"
            },
            colors: {
                neutral: colors.neutral
            },
            fontFamily: {
                sans: ['Inter', ...defaultTheme.fontFamily.sans]
            }
        }
    },
    daisyui: {
        themes: [
            {
                lofi: {
                    ...require('daisyui/src/theming/themes')['lofi'],
                    primary: '#2bdcd2',
                    'primary-content': '#171717',
                    secondary: '#016968',
                    info: '#2bdcd2',
                    'info-content': '#171717',
                }
            }
        ]
    },
    plugins: [require('daisyui')]
};

```

# tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "incremental": true,
    "module": "esnext",
    "esModuleInterop": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/utils": ["./utils"],
      "@/utils/*": ["./utils/*"],
      "@/app/*": ["./app/*"],
      "@/components/*": ["./components/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    ".next/types/**/*.ts",
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

# utils.js

```js
import { uniqueNamesGenerator, adjectives, animals, NumberDictionary } from 'unique-names-generator';

/*
Get the actual size of a resource downloaded by the browser (e.g. an image) in bytes.
This is supported in recent versions of all major browsers, with some caveats.
See https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/encodedBodySize
*/
export function getResourceSize(url) {
    const entry = window?.performance?.getEntriesByName(url)?.[0];
    if (entry) {
        const size = entry?.encodedBodySize;
        return size || undefined;
    } else {
        return undefined;
    }
}

// Note: this only works on the server side
export function getNetlifyContext() {
    return process.env.CONTEXT;
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const uniqueNamesConfig = {
    dictionaries: [adjectives, animals],
    separator: '-',
    length: 2
};

export function uniqueName() {
    return uniqueNamesGenerator(uniqueNamesConfig) + "-" + randomInt(100, 999);
}

export const uploadDisabled = process.env.NEXT_PUBLIC_DISABLE_UPLOADS?.toLowerCase() === "true";

```

# utils/auth.ts

```ts
import { jwtVerify, SignJWT } from 'jose';

interface TokenPayload {
 id: string;
 email: string;
 [key: string]: string | number; // Allow additional JWT payload properties
}

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
const alg = 'HS256';

export async function getTokenData(req: Request): Promise<TokenPayload | null> {
 const token = req.headers.get('cookie')?.split('token=')[1]?.split(';')[0];
 if (!token) return null;

 try {
   const { payload } = await jwtVerify(token, secretKey);
   return payload as TokenPayload;
 } catch (error) {
   return null;
 }
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
 try {
   const { payload } = await jwtVerify(token, secretKey);
   return payload as TokenPayload;
 } catch (error) {
   console.error('Token Verification Error:', error);
   return null;
 }
}

export async function generateToken(payload: TokenPayload): Promise<string> {
 const token = await new SignJWT(payload)
   .setProtectedHeader({ alg })
   .setIssuedAt()
   .setExpirationTime('24h')
   .sign(secretKey);
 return token;
}
```

# utils/mongodb-connection.ts

```ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development
 */
interface MongooseCache {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
}

let cached: MongooseCache = { conn: null, promise: null };

async function connectMongoDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts)
      .then((mongoose) => {
        console.log('MongoDB connected successfully');
        return mongoose.connection;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
}

export default connectMongoDB;
```


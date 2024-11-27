import { FeedbackForm } from 'components/feedback-form';
import { Markdown } from '../../components/markdown';
import { KeywordRankingForm } from 'components/keyword-ranking-form'; // Adjust import path as needed

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
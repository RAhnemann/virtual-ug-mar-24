import type { NextApiRequest, NextApiResponse } from 'next';

const routePurgeApi = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  // Check for secret to confirm this is a valid request
  if (req.headers.apikey !== process.env.ODISR_API_KEY || !process.env.ODISR_API_KEY) {
    return res.status(401).json({ message: 'Invalid API Key' });
  }

  const path = (req.headers.path as string)?.toString();

  if (!path || path === '') {
    return res.status(400).json({ message: 'Bad request: path' });
  }

  const userName = req.headers.userName;

  try {
    await res.revalidate(path);

    console.warn(`Purged Route [${userName}] [${path}]`);

    return res.status(202).json({ revalidated: true });
  } catch (err) {
    console.error(`Purged Route Failed [${userName}] [${path}]`);
    console.error(err);

    return res.status(500).send('Error revalidating');
  }
};

export default routePurgeApi;

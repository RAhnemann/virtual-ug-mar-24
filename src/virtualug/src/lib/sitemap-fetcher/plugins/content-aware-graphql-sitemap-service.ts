import { StaticPath, constants } from '@sitecore-jss/sitecore-jss-nextjs';
import { SitemapFetcherPlugin } from '..';
import { GetStaticPathsContext } from 'next';
import clientFactory from 'lib/graphql-client-factory';
import { ContentAwareGraphQLSitemapService } from 'src/services/content-aware-graph-sitemap';

class ContentAwareSitemapServicePlugin implements SitemapFetcherPlugin {
  _graphqlSitemapService: ContentAwareGraphQLSitemapService;

  constructor() {
    this._graphqlSitemapService = new ContentAwareGraphQLSitemapService({
      clientFactory,
    });
  }

  async exec(context?: GetStaticPathsContext): Promise<StaticPath[]> {
    if (process.env.JSS_MODE === constants.JSS_MODE.DISCONNECTED) {
      return [];
    }

    return this._graphqlSitemapService.fetchSSGSitemap(context?.locales || []);
  }
}

export const contentAwareGraphqlSitemapServicePlugin = new ContentAwareSitemapServicePlugin();

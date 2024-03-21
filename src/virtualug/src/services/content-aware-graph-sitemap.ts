import { GraphQLClient, PageInfo } from '@sitecore-jss/sitecore-jss/graphql';
import { debug, GraphQLRequestClient } from '@sitecore-jss/sitecore-jss-nextjs';
import { GraphQLRequestClientFactory } from '@sitecore-jss/sitecore-jss-nextjs/graphql';

/** @private */
export const languageEmptyError = 'The list of languages cannot be empty';
export const siteError = 'The service needs a site name';

/**
 * @param {string} siteName to inject into error text
 * @private
 */
export function getSiteEmptyError() {
  return `Site does not exist or site item tree is missing`;
}

/**
 * Configuration options for @see GraphQLSitemapService instances
 */
export interface ContentAwareGraphQLSitemapServiceConfig
  extends Omit<SiteRouteQueryVariables, 'language' | 'siteName'> {
  /**
   * Your Graphql endpoint
   * @deprecated use @param clientFactory property instead
   */
  endpoint?: string;

  /**
   * The API key to use for authentication.
   * @deprecated use @param clientFactory property instead
   */
  apiKey?: string;

  /**
   * A GraphQL Request Client Factory is a function that accepts configuration and returns an instance of a GraphQLRequestClient.
   * This factory function is used to create and configure GraphQL clients for making GraphQL API requests.
   */
  clientFactory?: GraphQLRequestClientFactory;
}

/**
 * The schema of data returned in response to a routes list query request
 */
export type RouteListQueryResult = {
  url: {
    path: string;
  };
};

/**
 * Object model of a site page item.
 */
export type StaticPath = {
  params: {
    path: string[];
  };
  locale?: string;
};
/**
 * type for input variables for the site routes query
 */
interface SiteRouteQueryVariables {
  /**
   * Required. The language to return routes/pages for.
   */
  language: string;
  /**
   * Optional. Only paths starting with these provided prefixes will be returned.
   */
  includedPaths?: string[];
  /**
   * Optional. Paths starting with these provided prefixes will be excluded from returned results.
   */
  excludedPaths?: string[];

  /** common variable for all GraphQL queries
   * it will be used for every type of query to regulate result batch size
   * Optional. How many result items to fetch in each GraphQL call. This is needed for pagination.
   * @default 100
   */
  pageSize?: number;
}

/**
 * Schema of data returned in response to a "site" query request
 * @template T The type of objects being requested.
 */
export interface SiteRouteQueryResult<T> {
  search: {
    total: number;
    pageInfo: PageInfo;
    results: T[];
  };
}

/**
 * Service that fetches the list of site pages using Sitecore's GraphQL API.
 * Used to handle a single site
 * This list is used for SSG and Export functionality.
 * @mixes SearchQueryService<PageListQueryResult>
 */
export class ContentAwareGraphQLSitemapService {
  private _graphQLClient: GraphQLClient;

  private query = `query PageSearch(
    $language: String!
    $hasLayout: String = "1"
    $includeSSG: String = "1"
    $pageSize: Int = 100
    $after: String!
  ) {
    search(
      where: {
        AND:[
          { name: "_language",  value: $language},
          { name: "_hasLayout", value: $hasLayout},
          { name: "IncludeInStaticGeneration", value: $includeSSG}
        ]
      }
      first: $pageSize
      after: $after
    ) {
      total
      pageInfo {
        endCursor
        hasNext
      }
      results {
          
        url {
          path
        }
      }
    }
  }`;

  /**
   * Creates an instance of graphQL sitemap service with the provided options
   * @param {ContentAwareGraphQLSitemapServiceConfig} options instance
   */
  constructor(public options: ContentAwareGraphQLSitemapServiceConfig) {
    this.options = options;
    this._graphQLClient = this.getGraphQLClient();
  }

  async fetchSSGSitemap(locales: string[]): Promise<StaticPath[]> {
    const formatPath = (path: string[], locale: string) => ({
      params: {
        path,
      },
      locale,
    });

    return this.fetchSitemap(locales, formatPath);
  }
  /**
   * Fetch a flat list of all pages that belong to the specificed site and have a
   * version in the specified language(s).
   * @param {string[]} languages Fetch pages that have versions in this language(s).
   * @param {Function} formatStaticPath Function for transforming the raw search results into (@see StaticPath) types.
   * @returns list of pages
   * @throws {RangeError} if the list of languages is empty.
   * @throws {RangeError} if the any of the languages is an empty string.
   */
  protected async fetchSitemap(
    languages: string[],
    formatStaticPath: (path: string[], language: string) => StaticPath
  ): Promise<StaticPath[]> {
    const paths = new Array<StaticPath>();
    if (!languages.length) {
      throw new RangeError(languageEmptyError);
    }

    paths.push(...(await this.getTranformedPaths(languages, formatStaticPath)));

    return ([] as StaticPath[]).concat(...paths);
  }

  protected async getTranformedPaths(
    languages: string[],
    formatStaticPath: (path: string[], language: string) => StaticPath
  ) {
    const paths = new Array<StaticPath>();

    for (const language of languages) {
      if (language === '') {
        throw new RangeError(languageEmptyError);
      }

      debug.sitemap('fetching sitemap data for %s %s', language);

      const results = await this.fetchLanguageSitePaths(language);
      const transformedPaths = await this.transformLanguageSitePaths(
        results,
        formatStaticPath,
        language
      );

      paths.push(...transformedPaths);
    }

    return paths;
  }

  protected async transformLanguageSitePaths(
    sitePaths: RouteListQueryResult[],
    formatStaticPath: (path: string[], language: string) => StaticPath,
    language: string
  ): Promise<StaticPath[]> {
    const formatPath = (path: string) =>
      formatStaticPath(path.replace(/^\/|\/$/g, '').split('/'), language);

    const aggregatedPaths: StaticPath[] = [];

    sitePaths.forEach((item) => {
      if (!item) return;

      aggregatedPaths.push(formatPath(item.url.path));
    });

    return aggregatedPaths;
  }

  protected async fetchLanguageSitePaths(language: string): Promise<RouteListQueryResult[]> {
    const args: SiteRouteQueryVariables = {
      language: language,
      pageSize: this.options.pageSize,
      includedPaths: this.options.includedPaths,
      excludedPaths: this.options.excludedPaths,
    };
    let results: RouteListQueryResult[] = [];
    let hasNext = true;
    let after = '';

    while (hasNext) {
      const fetchResponse = await this._graphQLClient.request<
        SiteRouteQueryResult<RouteListQueryResult>
      >(this.query, {
        ...args,
        after,
      });

      if (!fetchResponse?.search?.results) {
        throw new RangeError(getSiteEmptyError());
      } else {
        results = results.concat(fetchResponse.search.results);
        hasNext = fetchResponse.search.pageInfo.hasNext;
        after = fetchResponse.search.pageInfo.endCursor;
      }
    }

    return results;
  }
  protected getGraphQLClient(): GraphQLClient {
    if (!this.options.endpoint) {
      if (!this.options.clientFactory) {
        throw new Error('You should provide either an endpoint and apiKey, or a clientFactory.');
      }

      return this.options.clientFactory({
        debugger: debug.sitemap,
      });
    }

    return new GraphQLRequestClient(this.options.endpoint, {
      apiKey: this.options.apiKey,
      debugger: debug.sitemap,
    });
  }
}

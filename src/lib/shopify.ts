/**
 * Gamification Engine - Shopify Client
 * Shopify GraphQL API 2025-10 Client
 */

import { config } from '../config.js';

// GraphQL endpoint template
const getGraphQLEndpoint = (shopDomain: string): string => {
  return `https://${shopDomain}/admin/api/${config.shopify.apiVersion}/graphql.json`;
};

// GraphQL request helper
interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export interface ShopifyClientOptions {
  shopDomain: string;
  accessToken: string;
}

export class ShopifyClient {
  private shopDomain: string;
  private accessToken: string;
  private endpoint: string;

  constructor(options: ShopifyClientOptions) {
    this.shopDomain = options.shopDomain;
    this.accessToken = options.accessToken;
    this.endpoint = getGraphQLEndpoint(options.shopDomain);
  }

  /**
   * Execute a GraphQL query/mutation
   */
  async query<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse<T>> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<GraphQLResponse<T>>;
  }

  /**
   * Get shop information
   */
  async getShop() {
    const query = `
      query GetShop {
        shop {
          id
          name
          email
          myshopifyDomain
          primaryDomain {
            url
          }
          currencyCode
          billingAddress {
            country
          }
        }
      }
    `;

    return this.query<{
      shop: {
        id: string;
        name: string;
        email: string;
        myshopifyDomain: string;
        primaryDomain: { url: string };
        currencyCode: string;
        billingAddress: { country: string };
      };
    }>(query);
  }

  /**
   * Create a discount code
   * Using Shopify GraphQL 2025-10 API
   */
  async createDiscountCode(params: {
    title: string;
    code: string;
    percentage?: number;
    fixedAmount?: number;
    freeShipping?: boolean;
    startsAt: string;
    endsAt: string;
    usageLimit?: number;
    appliesOncePerCustomer?: boolean;
    minimumRequirement?: {
      subtotal?: number;
      quantity?: number;
    };
    customerSelection?: 'all' | string[];
    combinesWith?: {
      productDiscounts?: boolean;
      orderDiscounts?: boolean;
      shippingDiscounts?: boolean;
    };
  }) {
    // Determine discount type
    let customerGetsValue: string;

    if (params.freeShipping) {
      // Free shipping discount
      const mutation = `
        mutation discountCodeFreeShippingCreate($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) {
          discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) {
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeFreeShipping {
                  title
                  codes(first: 1) {
                    nodes {
                      code
                    }
                  }
                  startsAt
                  endsAt
                }
              }
            }
            userErrors {
              field
              message
              code
            }
          }
        }
      `;

      return this.query(mutation, {
        freeShippingCodeDiscount: {
          title: params.title,
          code: params.code,
          startsAt: params.startsAt,
          endsAt: params.endsAt,
          usageLimit: params.usageLimit,
          appliesOncePerCustomer: params.appliesOncePerCustomer ?? true,
          customerSelection: {
            all: true,
          },
          destination: {
            all: true,
          },
          combinesWith: {
            productDiscounts: params.combinesWith?.productDiscounts ?? false,
            orderDiscounts: params.combinesWith?.orderDiscounts ?? false,
          },
        },
      });
    }

    // Percentage or fixed amount discount
    if (params.percentage) {
      customerGetsValue = `percentageValue: ${params.percentage / 100}`;
    } else if (params.fixedAmount) {
      customerGetsValue = `
        discountAmount: {
          amount: ${params.fixedAmount}
          appliesOnEachItem: false
        }
      `;
    } else {
      throw new Error('Either percentage or fixedAmount must be provided');
    }

    const mutation = `
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
                startsAt
                endsAt
                customerGets {
                  value {
                    ... on DiscountPercentage {
                      percentage
                    }
                    ... on DiscountAmount {
                      amount {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const variables: Record<string, unknown> = {
      basicCodeDiscount: {
        title: params.title,
        code: params.code,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        usageLimit: params.usageLimit,
        appliesOncePerCustomer: params.appliesOncePerCustomer ?? true,
        customerSelection: {
          all: true,
        },
        customerGets: {
          value: params.percentage
            ? { percentage: params.percentage / 100 }
            : { discountAmount: { amount: params.fixedAmount, appliesOnEachItem: false } },
          items: {
            all: true,
          },
        },
        combinesWith: {
          productDiscounts: params.combinesWith?.productDiscounts ?? false,
          orderDiscounts: params.combinesWith?.orderDiscounts ?? false,
          shippingDiscounts: params.combinesWith?.shippingDiscounts ?? true,
        },
      },
    };

    // Add minimum requirement if specified
    if (params.minimumRequirement?.subtotal) {
      (variables.basicCodeDiscount as Record<string, unknown>).minimumRequirement = {
        subtotal: {
          greaterThanOrEqualToSubtotal: params.minimumRequirement.subtotal,
        },
      };
    } else if (params.minimumRequirement?.quantity) {
      (variables.basicCodeDiscount as Record<string, unknown>).minimumRequirement = {
        quantity: {
          greaterThanOrEqualToQuantity: params.minimumRequirement.quantity,
        },
      };
    }

    return this.query(mutation, variables);
  }

  /**
   * Delete a discount code
   */
  async deleteDiscountCode(discountId: string) {
    const mutation = `
      mutation discountCodeDelete($id: ID!) {
        discountCodeDelete(id: $id) {
          deletedCodeDiscountId
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    return this.query(mutation, { id: discountId });
  }

  /**
   * Get products for rule configuration
   */
  async getProducts(first: number = 50, after?: string) {
    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            handle
            status
            featuredImage {
              url(transform: { maxWidth: 100, maxHeight: 100 })
            }
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    `;

    return this.query(query, { first, after });
  }

  /**
   * Get collections for rule configuration
   */
  async getCollections(first: number = 50, after?: string) {
    const query = `
      query GetCollections($first: Int!, $after: String) {
        collections(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            handle
            productsCount {
              count
            }
            image {
              url(transform: { maxWidth: 100, maxHeight: 100 })
            }
          }
        }
      }
    `;

    return this.query(query, { first, after });
  }
}

/**
 * Create a Shopify client for a shop
 */
export function createShopifyClient(shopDomain: string, accessToken: string): ShopifyClient {
  return new ShopifyClient({ shopDomain, accessToken });
}


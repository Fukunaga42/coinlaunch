import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import TokenList from '@/components/tokens/TokenList';
import SearchFilter from '@/components/ui/SearchFilter';
import HowItWorksPopup from '@/components/notifications/HowItWorksPopup';
import SortOptions, { SortOption } from '@/components/ui/SortOptions';
import { getAllTokensTrends, getTokensWithLiquidity, getRecentTokens, searchTokens } from '@/utils/api';
import { Token, TokenWithLiquidityEvents, PaginatedResponse } from '@/interface/types';
import SEO from '@/components/seo/SEO';
import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { Switch } from '@/components/ui/switch';
import Spinner from '@/components/ui/Spinner';
import { useRouter } from 'next/router';

const TOKENS_PER_PAGE = 100;

const TYPEWRITER_TEXTS = [
  {
    heading: "Launch coins on X,",
    subheading: "tweet to go viral!"
  },
  {
    heading: "X-born tokens shine,",
    subheading: "trade on CoinLaunch."
  },
  {
    heading: "Tweet your coin live,",
    subheading: "join the X hype!"
  }
];

const Home: React.FC = () => {
  const [tokens, setTokens] = useState<PaginatedResponse<Token | TokenWithLiquidityEvents> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [noRecentTokens, setNoRecentTokens] = useState(false);
  const [noLiquidityTokens, setNoLiquidityTokens] = useState(false);
  const [showNewTokens, setShowNewTokens] = useState(false);
  const [newTokensBuffer, setNewTokensBuffer] = useState<Token[]>([]);
  const [displayedNewTokens, setDisplayedNewTokens] = useState<Token[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { newTokens } = useWebSocket();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [allTrendingTokens, setAllTrendingTokens] = useState<Token[]>([]);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState({ heading: "", subheading: "" });
  const [isTyping, setIsTyping] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log('Effect triggered. Current sort:', sort, 'Current page:', currentPage, 'Search:', searchQuery);
    fetchTokens();
  }, [currentPage, sort, searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      if (
          window.innerHeight + document.documentElement.scrollTop >=
          document.documentElement.offsetHeight - 300 &&
          !isFetchingMore &&
          !isLoading &&
          tokens &&
          currentPage < (tokens.totalPages || 1)
      ) {
        setIsFetchingMore(true);
        setCurrentPage(prev => prev + 1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFetchingMore, isLoading, tokens, currentPage]);

  useEffect(() => {
    fetchTokens(currentPage);
  }, [currentPage, sort, searchQuery]);


  useEffect(() => {
    // console.log('New tokens received:', newTokens);
    if (newTokens.length > 0) {
      if (showNewTokens) {
        setTokens(prevTokens => {
          if (!prevTokens) return null;
          const newUniqueTokens = newTokens.filter(newToken =>
            !prevTokens.data.some(existingToken => existingToken.id === newToken.id) &&
            !displayedNewTokens.some(displayedToken => displayedToken.id === newToken.id)
          );
          // console.log('New unique tokens to add:', newUniqueTokens);
          setDisplayedNewTokens(prev => [...prev, ...newUniqueTokens]);
          return {
            ...prevTokens,
            data: [...newUniqueTokens, ...prevTokens.data],
            totalCount: prevTokens.totalCount + newUniqueTokens.length
          };
        });
      } else {
        setNewTokensBuffer(prev => {
          const uniqueNewTokens = newTokens.filter(newToken =>
            !prev.some(bufferToken => bufferToken.id === newToken.id)
          );
          // console.log('New tokens added to buffer:', uniqueNewTokens);
          return [...uniqueNewTokens, ...prev];
        });
      }
    }
  }, [newTokens, showNewTokens]);

  const fetchTokens = async (page = 1) => {
    setIsLoading(page === 1);  // only show spinner on first load
    setError(null);

    try {
      let fetchedTokens;
      const query = searchQuery.trim() || '__all__';
      fetchedTokens = await searchTokens(query, page, TOKENS_PER_PAGE);

      const newData = fetchedTokens.data || fetchedTokens.tokens || [];

      if (page === 1) {
        setTokens({
          data: newData,
          totalCount: fetchedTokens.totalCount,
          currentPage: page,
          totalPages: fetchedTokens.totalPages || 1,
          tokens: [],
          fullList: [],
        });
      } else {
        setTokens(prev => {
          if (!prev) return null;
          return {
            ...prev,
            data: [...prev.data, ...newData],
            currentPage: page,
          };
        });
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setError('Failed to fetch tokens. Please try again later.');
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  const filteredTokens = useMemo(() => {
    if (!tokens || !tokens.data) return [];
    return tokens.data.filter(token =>
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tokens, searchQuery]);

  const handleSearch = (query: string) => {
    console.log('Search query updated:', query);
    if (query !== searchQuery) {
      setSearchQuery(query);
      if (query.trim()) {
        setCurrentPage(1);
      }
      if (!query.trim()) {
        fetchTokens();
      }
    }
  };

  const handleSort = async (option: SortOption) => {
    console.log('Sort option changed:', option);
    setIsLoading(true);

    try {
      // If switching to marketcap and we don't have trending tokens, fetch them
      // if (option === 'marketcap' && allTrendingTokens.length === 0) {
      //   const trendingTokens = await getAllTokensTrends();
      //   setAllTrendingTokens(trendingTokens);
      // }

      // Only clear trending tokens when switching to 'new' or 'finalized'
      // if (option === 'new' || option === 'finalized') {
      //   setAllTrendingTokens([]);
      // }

      setSort(option);
      setCurrentPage(1);
      setSearchQuery('');
    } catch (error) {
      console.error('Error handling sort:', error);
      setError('Failed to sort tokens. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    console.log('Page changed:', page);
    setCurrentPage(page);
  };

  const toggleNewTokens = () => {
    setShowNewTokens(prev => {
      // console.log('Toggling new tokens. Current state:', prev);
      if (prev) {
        // Turning off
        setTokens(oldTokens => {
          if (!oldTokens) return null;
          const updatedTokens = {
            ...oldTokens,
            data: oldTokens.data.filter(token => !displayedNewTokens.includes(token)),
            totalCount: oldTokens.totalCount - displayedNewTokens.length
          };
          // console.log('Updated tokens after turning off:', updatedTokens);
          return updatedTokens;
        });
        setNewTokensBuffer(displayedNewTokens);
        setDisplayedNewTokens([]);
      } else {
        // Turning on
        setTokens(oldTokens => {
          if (!oldTokens) return null;
          const updatedTokens = {
            ...oldTokens,
            data: [...newTokensBuffer, ...oldTokens.data],
            totalCount: oldTokens.totalCount + newTokensBuffer.length
          };
          // console.log('Updated tokens after turning on:', updatedTokens);
          return updatedTokens;
        });
        setDisplayedNewTokens(newTokensBuffer);
        setNewTokensBuffer([]);
      }
      return !prev;
    });
  };

  const handleLaunchToken = () => {
    router.push('/create');
  };

  // Typewriter effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const typeText = async () => {
      const currentText = TYPEWRITER_TEXTS[currentTextIndex];

      // Type heading
      for (let i = 0; i <= currentText.heading.length; i++) {
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 50);
        });
        setDisplayText(prev => ({
          ...prev,
          heading: currentText.heading.slice(0, i)
        }));
      }

      // Type subheading
      for (let i = 0; i <= currentText.subheading.length; i++) {
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 50);
        });
        setDisplayText(prev => ({
          ...prev,
          subheading: currentText.subheading.slice(0, i)
        }));
      }

      // Pause before deleting
      await new Promise(resolve => {
        timeoutId = setTimeout(resolve, 2000);
      });

      // Delete text
      for (let i = currentText.subheading.length; i >= 0; i--) {
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 30);
        });
        setDisplayText(prev => ({
          ...prev,
          subheading: currentText.subheading.slice(0, i)
        }));
      }

      for (let i = currentText.heading.length; i >= 0; i--) {
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 30);
        });
        setDisplayText(prev => ({
          ...prev,
          heading: currentText.heading.slice(0, i)
        }));
      }

      // Move to next text
      setCurrentTextIndex((prev) => (prev + 1) % TYPEWRITER_TEXTS.length);
    };

    if (isTyping) {
      typeText();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentTextIndex, isTyping]);

  // console.log('Rendering component. isLoading:', isLoading, 'tokens:', tokens, 'filteredTokens:', filteredTokens);

  return (
    <Layout>
      <SEO
        title="Create and Trade Memecoins Easily on Coinlaunch."
        description="The ultimate platform for launching and trading memecoins on Shibarium. Create your own tokens effortlessly and engage in fair, dynamic trading."
        image="seo/home.jpg"
      />
      <HowItWorksPopup isVisible={showHowItWorks} onClose={() => setShowHowItWorks(false)} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-4">
          <div className="h-[80px]"> {/* Reduced height from 120px to 80px */}
            <h1 className="text-3xl font-bold mb-1">{displayText.heading}</h1>
            <h2 className="text-2xl mb-3">{displayText.subheading}</h2>
          </div>

          <div className="mb-4">
            <SearchFilter onSearch={handleSearch} />
            <div className="mb-4">
              <div className="flex flex-col gap-2 md:hidden">
                {/*<div className="flex justify-center">*/}
                {/*  <SortOptions onSort={handleSort} currentSort={sort} />*/}
                {/*</div>*/}
                {/*<div className="flex justify-center items-center gap-2">*/}
                {/*  <span className="text-sm text-gray-400">Live Updates</span>*/}
                {/*  <Switch*/}
                {/*    checked={showNewTokens}*/}
                {/*    onCheckedChange={toggleNewTokens}*/}
                {/*    className={`${*/}
                {/*      showNewTokens ? 'bg-[var(--primary)]' : 'bg-gray-600'*/}
                {/*    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-gray-800`}*/}
                {/*  >*/}
                {/*    <span*/}
                {/*      className={`${*/}
                {/*        showNewTokens ? 'translate-x-6' : 'translate-x-1'*/}
                {/*      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}*/}
                {/*    />*/}
                {/*  </Switch>*/}
                {/*  {!showNewTokens && newTokensBuffer.length > 0 && (*/}
                {/*    <span className="text-xs text-[var(--primary)]">*/}
                {/*      {newTokensBuffer.length} new {newTokensBuffer.length === 1 ? 'token' : 'tokens'}*/}
                {/*    </span>*/}
                {/*  )}*/}
                {/*</div>*/}
              </div>

              <div className="hidden md:flex md:items-center md:justify-between">
                {/*<div className="flex justify-center flex-grow">*/}
                {/*  <SortOptions onSort={handleSort} currentSort={sort} />*/}
                {/*</div>*/}
                {/*<div className="flex items-center gap-2">*/}
                {/*  <span className="text-sm text-gray-400">Live Updates</span>*/}
                {/*  <Switch*/}
                {/*    checked={showNewTokens}*/}
                {/*    onCheckedChange={toggleNewTokens}*/}
                {/*    className={`${*/}
                {/*      showNewTokens ? 'bg-[var(--primary)]' : 'bg-gray-600'*/}
                {/*    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-gray-800`}*/}
                {/*  >*/}
                {/*    <span*/}
                {/*      className={`${*/}
                {/*        showNewTokens ? 'translate-x-6' : 'translate-x-1'*/}
                {/*      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}*/}
                {/*    />*/}
                {/*  </Switch>*/}
                {/*  {!showNewTokens && newTokensBuffer.length > 0 && (*/}
                {/*    <span className="text-xs text-[var(--primary)]">*/}
                {/*      {newTokensBuffer.length} new {newTokensBuffer.length === 1 ? 'token' : 'tokens'}*/}
                {/*    </span>*/}
                {/*  )}*/}
                {/*</div>*/}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center mt-10">
              <Spinner size="medium" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 text-xl mt-10">{error}</div>
          ) : noRecentTokens ? (
            <div className="text-center text-white text-xs mt-10">No tokens created in the last 24 hours. Check back soon.</div>
          ) : noLiquidityTokens ? (
            <div className="text-center text-white text-xs mt-10">No tokens Listed Yet.</div>
          ) : filteredTokens.length > 0 ? (
            <TokenList
              tokens={filteredTokens}
              currentPage={currentPage}
              totalPages={tokens?.totalPages || 1}
              onPageChange={handlePageChange}
              isEnded={sort === 'finalized'}
              sortType={sort}
              itemsPerPage={TOKENS_PER_PAGE}
              isFullList={tokens?.fullList}
            />
          ) : (
            <div className="text-center text-white text-xs mt-10">No tokens found matching your criteria.</div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Home;

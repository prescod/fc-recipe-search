import React from "react";
import fetch from "unfetch";
import MiniSearch from "minisearch";
import Papa from "papaparse";

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    const miniSearch = new MiniSearch({
      fields: ["page", "recipe"],
      processTerm: (term, _fieldName) =>
        term.length <= 1 || stopWords.has(term) ? null : term.toLowerCase(),
    });
    [
      "handleSearchChange",
      "handleSearchKeyDown",
      "handleSuggestionClick",
      "handleSearchClear",
      "handleAppClick",
      "setSearchOption",
      "performSearch",
      "setFromYear",
      "setToYear",
    ].forEach((method) => {
      this[method] = this[method].bind(this);
    });
    this.searchInputRef = React.createRef();
    this.state = {
      matchingRecipes: [],
      RecipesById: null,
      searchValue: "",
      ready: false,
      suggestions: [],
      selectedSuggestion: -1,
      fromYear: 1965,
      toYear: 2015,
      searchOptions: {
        fuzzy: 0.2,
        prefix: true,
        fields: ["recipe", "page"],
        combineWith: "AND",
        filter: null,
      },
      miniSearch,
    };
  }

  componentDidMount() {
    fetch("fcdata.csv")
      .then((response) => response.text())
      .then((csvString) => {
        // Parse the CSV data
        const parsedData = Papa.parse(csvString, { header: true });
        const records = parsedData.data;

        // Map CSV data to the desired format
        const allRecipes = records.map((record, index) => ({
          id: index,
          reference: record.Reference,
          recipe: record["Recipe/Other"],
          page: record.Page,
        }));

        // Update state with RecipesById
        const recipesById = allRecipes.reduce((byId, song) => {
          byId[song.id] = song;
          return byId;
        }, {});
        this.setState({ RecipesById: recipesById });

        // Add data to miniSearch
        return this.state.miniSearch.addAllAsync(allRecipes);
      })
      .then(() => {
        this.setState({ ready: true });
      })
      .catch((error) => {
        console.error("Error fetching or parsing CSV:", error);
      });
  }

  handleSearchChange({ target: { value } }) {
    this.setState({ searchValue: value });
    const matchingRecipes = value.length > 1 ? this.searchRecipes(value) : [];
    const selectedSuggestion = -1;
    const suggestions = this.getSuggestions(value);
    this.setState({ matchingRecipes, suggestions, selectedSuggestion });
  }

  handleSearchKeyDown({ which, key, keyCode }) {
    let { suggestions, selectedSuggestion, searchValue } = this.state;
    if (key === "ArrowDown") {
      selectedSuggestion = Math.min(
        selectedSuggestion + 1,
        suggestions.length - 1
      );
      searchValue = suggestions[selectedSuggestion].suggestion;
    } else if (key === "ArrowUp") {
      selectedSuggestion = Math.max(0, selectedSuggestion - 1);
      searchValue = suggestions[selectedSuggestion].suggestion;
    } else if (key === "Enter" || key === "Escape") {
      selectedSuggestion = -1;
      suggestions = [];
      this.searchInputRef.current.blur();
    } else {
      return;
    }
    const matchingRecipes = this.searchRecipes(searchValue);
    this.setState({
      suggestions,
      selectedSuggestion,
      searchValue,
      matchingRecipes,
    });
  }

  handleSuggestionClick(i) {
    let { suggestions } = this.state;
    const searchValue = suggestions[i].suggestion;
    const matchingRecipes = this.searchRecipes(searchValue);
    this.setState({
      searchValue,
      matchingRecipes,
      suggestions: [],
      selectedSuggestion: -1,
    });
  }

  handleSearchClear() {
    this.setState({
      searchValue: "",
      matchingRecipes: [],
      suggestions: [],
      selectedSuggestion: -1,
    });
  }

  handleAppClick() {
    this.setState({ suggestions: [], selectedSuggestion: -1 });
  }

  setSearchOption(option, valueOrFn) {
    if (typeof valueOrFn === "function") {
      this.setState(
        ({ searchOptions }) => ({
          searchOptions: {
            ...searchOptions,
            [option]: valueOrFn(searchOptions[option]),
          },
        }),
        this.performSearch
      );
    } else {
      this.setState(
        ({ searchOptions }) => ({
          searchOptions: { ...searchOptions, [option]: valueOrFn },
        }),
        this.performSearch
      );
    }
  }

  setFromYear(year) {
    this.setState(({ toYear, searchOptions }) => {
      const fromYear = parseInt(year, 10);
      if (fromYear <= 1965 && toYear >= 2015) {
        return { fromYear, searchOptions: { ...searchOptions, filter: null } };
      } else {
        const filter = ({ year }) => {
          year = parseInt(year, 10);
          return year >= fromYear && year <= toYear;
        };
        return { fromYear, searchOptions: { ...searchOptions, filter } };
      }
    }, this.performSearch);
  }

  setToYear(year) {
    this.setState(({ fromYear, searchOptions }) => {
      const toYear = parseInt(year, 10);
      if (fromYear <= 1965 && toYear >= 2015) {
        return { toYear, searchOptions: { ...searchOptions, filter: null } };
      } else {
        const filter = ({ year }) => {
          year = parseInt(year, 10);
          return year >= fromYear && year <= toYear;
        };
        return { toYear, searchOptions: { ...searchOptions, filter } };
      }
    }, this.performSearch);
  }

  searchRecipes(query) {
    const { miniSearch, RecipesById, searchOptions } = this.state;
    return miniSearch
      .search(query, searchOptions)
      .map(({ id }) => RecipesById[id]);
  }

  performSearch() {
    const { searchValue } = this.state;
    const matchingRecipes = this.searchRecipes(searchValue);
    this.setState({ matchingRecipes });
  }

  getSuggestions(query) {
    const { miniSearch, searchOptions } = this.state;
    const prefix = (term, i, terms) => i === terms.length - 1;
    return miniSearch
      .autoSuggest(query, { ...searchOptions, prefix, boost: { page: 5 } })
      .filter(({ suggestion, score }, _, [first]) => score > first.score / 4)
      .slice(0, 5);
  }

  render() {
    const {
      matchingRecipes,
      searchValue,
      ready,
      suggestions,
      selectedSuggestion,
      searchOptions,
      fromYear,
      toYear,
    } = this.state;
    return (
      <div className="App" onClick={this.handleAppClick}>
        <article className="main">
          {ready ? (
            <Header
              onChange={this.handleSearchChange}
              onKeyDown={this.handleSearchKeyDown}
              selectedSuggestion={selectedSuggestion}
              onSuggestionClick={this.handleSuggestionClick}
              onSearchClear={this.handleSearchClear}
              value={searchValue}
              suggestions={suggestions}
              searchInputRef={this.searchInputRef}
              searchOptions={searchOptions}
              setSearchOption={this.setSearchOption}
            />
          ) : (
            <Loader />
          )}
          {matchingRecipes && matchingRecipes.length > 0 ? (
            <SongList Recipes={matchingRecipes} />
          ) : (
            ready && <Explanation />
          )}
        </article>
      </div>
    );
  }
}

const SongList = ({ Recipes }) => (
  <ul className="SongList">
    {Recipes.map(({ id, ...props }) => (
      <Song {...props} key={id} />
    ))}
  </ul>
);

const Song = ({ recipe, page, reference }) => (
  <li className="Song">
    <h3>{capitalize(recipe)}</h3>
    <dl>
      <dt>Issue:</dt> <dd>{reference}</dd>
      <dt>Page:</dt> <dd>{capitalize(page)}</dd>
    </dl>
  </li>
);

const Header = (props) => (
  <header className="Header">
    <h1>Fine Cooking Search</h1>
    <SearchBox {...props} />
  </header>
);

const SearchBox = ({
  onChange,
  onKeyDown,
  onSuggestionClick,
  onSearchClear,
  value,
  suggestions,
  selectedSuggestion,
  searchInputRef,
  searchOptions,
  setSearchOption,
  setFromYear,
  setToYear,
  fromYear,
  toYear,
}) => (
  <div className="SearchBox">
    <div className="Search">
      <input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        ref={searchInputRef}
        autoComplete="none"
        autoCorrect="none"
        autoCapitalize="none"
        spellCheck="false"
      />
      <button className="clear" onClick={onSearchClear}>
        &times;
      </button>
    </div>
    {suggestions && suggestions.length > 0 && (
      <SuggestionList
        items={suggestions}
        selectedSuggestion={selectedSuggestion}
        onSuggestionClick={onSuggestionClick}
      />
    )}
    <AdvancedOptions options={searchOptions} setOption={setSearchOption} />
  </div>
);

const SuggestionList = ({ items, selectedSuggestion, onSuggestionClick }) => (
  <ul className="SuggestionList">
    {items.map(({ suggestion }, i) => (
      <Suggestion
        value={suggestion}
        selected={selectedSuggestion === i}
        onClick={(event) => onSuggestionClick(i, event)}
        key={i}
      />
    ))}
  </ul>
);

const Suggestion = ({ value, selected, onClick }) => (
  <li className={`Suggestion ${selected ? "selected" : ""}`} onClick={onClick}>
    {value}
  </li>
);

const AdvancedOptions = ({
  options,
  setOption,
  setFromYear,
  setToYear,
  fromYear,
  toYear,
}) => {
  const setField =
    (field) =>
    ({ target: { checked } }) => {
      setOption("fields", (fields) => {
        return checked ? [...fields, field] : fields.filter((f) => f !== field);
      });
    };
  const setKey =
    (key, trueValue = true, falseValue = false) =>
    ({ target: { checked } }) => {
      setOption(key, checked ? trueValue : falseValue);
    };
  const { fields, combineWith, fuzzy, prefix } = options;
  return (
    <details className="AdvancedOptions">
      <summary>Advanced options</summary>
      <div className="options">
        <div>
          <b>Search in fields:</b>
          <label>
            <input
              type="checkbox"
              checked={fields.includes("recipe")}
              onChange={setField("recipe")}
            />
            Recipe
          </label>
          <label>
            <input
              type="checkbox"
              checked={fields.includes("page")}
              onChange={setField("page")}
            />
            Page
          </label>
        </div>
        <div>
          <b>Search options:</b>
          <label>
            <input
              type="checkbox"
              checked={!!prefix}
              onChange={setKey("prefix")}
            />{" "}
            Prefix
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!fuzzy}
              onChange={setKey("fuzzy", 0.2)}
            />{" "}
            Fuzzy
          </label>
        </div>
        <div>
          <b>Combine terms with:</b>
          <label>
            <input
              type="radio"
              checked={combineWith === "OR"}
              onChange={setKey("combineWith", "OR", "AND")}
            />{" "}
            OR
          </label>
          <label>
            <input
              type="radio"
              checked={combineWith === "AND"}
              onChange={setKey("combineWith", "AND", "OR")}
            />{" "}
            AND
          </label>
        </div>
        <div>
          <b>Filter:</b>
          <label>
            from year:
            <select
              value={fromYear}
              onChange={({ target: { value } }) => setFromYear(value)}
            >
              {years
                .filter((year) => year <= toYear)
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
          </label>
          <label>
            to year:
            <select
              value={toYear}
              onChange={({ target: { value } }) => setToYear(value)}
            >
              {years
                .filter((year) => year >= fromYear)
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </div>
    </details>
  );
};

const Explanation = () => <p>Made with love for our Mom, Lilia!</p>;

const Loader = ({ text }) => (
  <div className="Loader">{text || "loading..."}</div>
);

const capitalize = (string) =>
  string.replace(/(\b\w)/gi, (char) => char.toUpperCase());

const stopWords = new Set(["the", "a", "an", "and"]);

const years = [];
for (let y = 1965; y <= 2015; y++) {
  years.push(y);
}

export default App;

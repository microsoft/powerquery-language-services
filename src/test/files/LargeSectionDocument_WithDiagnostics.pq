[Version = "1.0.0"]
section LargeSectionDocument_WithDiagnostics;

// This is a complex M section document designed to test validation performance
// It contains many unknown identifiers and other diagnostic errors but NO parsing errors
// Constants and basic values
BaseUrl = "https://api.example.com/v1/";
MaxRetries = 5;
DefaultTimeout = 30;

// Complex functions with unknown identifiers to generate diagnostic errors
shared ComplexFunction1 = (param1 as text, param2 as number, param3 as logical) as table =>
    let
        Source = UnknownTableFunction(param1, param2),
        Step1 = Table.AddColumn(Source, "NewCol", each UnknownScalarFunction([Column1], [Column2])),
        Step2 = Table.TransformColumns(Step1, {{"NewCol", each UnknownTransformFunction(_)}}),
        Step3 = Table.SelectRows(Step2, each UnknownFilterFunction([NewCol], param3)),
        Result = Table.Sort(Step3, {{"NewCol", UnknownOrderFunction}})
    in
        Result;

shared ComplexFunction2 = (data as table, config as record) as table =>
    let
        Column1 = Table.Column(data, UnknownColumnName1),
        Column2 = Table.Column(data, UnknownColumnName2),
        Processed1 = List.Transform(Column1, each UnknownProcessor1(_)),
        Processed2 = List.Transform(Column2, each UnknownProcessor2(_)),
        CombinedTable = #table({"Proc1", "Proc2"}, List.Zip({Processed1, Processed2})),
        Aggregated = Table.Group(CombinedTable, {"Proc1"}, {{"Proc2Sum", each List.Sum([Proc2]), type number}}),
        Final = Table.AddColumn(Aggregated, "Calculated", each UnknownCalculation([Proc1], [Proc2Sum]))
    in
        Final;

shared ComplexFunction3 = (inputList as list, operations as list) as list =>
    let
        ProcessOperation = (current as list, operation as record) as list =>
            let
                OperationType = Record.Field(operation, "Type"), Parameter = Record.Field(operation, "Parameter")
            in
                if OperationType = "unknown1" then
                    List.Transform(current, each UnknownFunction1(_, Parameter))
                else if OperationType = "unknown2" then
                    List.Select(current, each UnknownFunction2(_, Parameter))
                else if OperationType = "unknown3" then
                    List.Sort(current, each UnknownFunction3(_, Parameter))
                else
                    current,
        Result = List.Accumulate(operations, inputList, ProcessOperation)
    in
        Result;

shared ComplexFunction4 = (textData as text, patterns as list) as record =>
    let
        ExtractPattern = (text as text, pattern as record) as any =>
            let
                PatternType = Record.Field(pattern, "Type"), PatternValue = Record.Field(pattern, "Value")
            in
                if PatternType = "unknown" then
                    UnknownExtractor(textData, PatternValue)
                else if PatternType = "custom" then
                    CustomUnknownExtractor(textData, PatternValue)
                else
                    null,
        Results = List.Transform(patterns, each ExtractPattern(textData, _)),
        Summary = [
            TotalMatches = List.Count(List.Select(Results, each _ <> null)),
            FirstMatch = UnknownFirstFunction(Results),
            LastMatch = UnknownLastFunction(Results),
            ProcessedResults = List.Transform(Results, each UnknownResultProcessor(_))
        ]
    in
        Summary;

shared ComplexFunction5 = (numericData as list, analysisType as text) as record =>
    let
        BasicStats = [
            Sum = List.Sum(numericData),
            Average = List.Average(numericData),
            Count = List.Count(numericData)
        ],
        AdvancedStats =
            if analysisType = "advanced" then
                [
                    StandardDev = UnknownStandardDeviation(numericData),
                    Variance = UnknownVariance(numericData),
                    Median = UnknownMedian(numericData),
                    Quartiles = UnknownQuartiles(numericData),
                    Outliers = UnknownOutlierDetection(numericData)
                ]
            else
                [],
        CombinedStats = BasicStats & AdvancedStats,
        ProcessedStats = Record.TransformFields(
            CombinedStats,
            {
                {"Sum", each UnknownSumProcessor(_)},
                {"Average", each UnknownAverageProcessor(_)},
                {"Count", each UnknownCountProcessor(_)}
            }
        )
    in
        ProcessedStats;

shared MachineLearningPipeline = (trainingData as table, features as list, target as text) as record =>
    let
        // Data preprocessing with unknown functions
        CleanedData = UnknownDataCleaner(trainingData),
        FeatureMatrix = UnknownFeatureExtractor(CleanedData, features),
        NormalizedFeatures = UnknownNormalizer(FeatureMatrix),
        EncodedFeatures = UnknownCategoricalEncoder(NormalizedFeatures),
        // Feature selection with unknown functions
        SelectedFeatures = UnknownFeatureSelector(EncodedFeatures, target),
        ImportanceScores = UnknownFeatureImportance(SelectedFeatures, target),
        // Model training with unknown functions
        TrainTestSplit = UnknownTrainTestSplitter(SelectedFeatures, 0.8),
        TrainingSet = TrainTestSplit[Training],
        TestingSet = TrainTestSplit[Testing],
        Models = [
            LinearRegression = UnknownLinearRegression(TrainingSet, target),
            RandomForest = UnknownRandomForest(TrainingSet, target),
            XGBoost = UnknownXGBoost(TrainingSet, target),
            NeuralNetwork = UnknownNeuralNetwork(TrainingSet, target),
            SVM = UnknownSVM(TrainingSet, target)
        ],
        // Model evaluation with unknown functions
        Predictions = Record.TransformFields(
            Models,
            {
                "LinearRegression",
                each UnknownPredict(_, TestingSet),
                "RandomForest",
                each UnknownPredict(_, TestingSet),
                "XGBoost",
                each UnknownPredict(_, TestingSet),
                "NeuralNetwork",
                each UnknownPredict(_, TestingSet),
                "SVM",
                each UnknownPredict(_, TestingSet)
            }
        ),
        Metrics = Record.TransformFields(
            Predictions,
            {
                "LinearRegression",
                each UnknownEvaluateModel(_, TestingSet[target]),
                "RandomForest",
                each UnknownEvaluateModel(_, TestingSet[target]),
                "XGBoost",
                each UnknownEvaluateModel(_, TestingSet[target]),
                "NeuralNetwork",
                each UnknownEvaluateModel(_, TestingSet[target]),
                "SVM",
                each UnknownEvaluateModel(_, TestingSet[target])
            }
        ),
        BestModel = UnknownModelSelector(Metrics),
        Hyperparameters = UnknownHyperparameterTuner(BestModel, TrainingSet),
        FinalModel = UnknownModelTrainer(BestModel, Hyperparameters, TrainingSet)
    in
        [
            Data = [
                Original = trainingData,
                Cleaned = CleanedData,
                Features = SelectedFeatures,
                Training = TrainingSet,
                Testing = TestingSet
            ],
            Models = Models,
            Evaluation = [
                Predictions = Predictions,
                Metrics = Metrics,
                BestModel = BestModel
            ],
            FinalModel = FinalModel,
            FeatureImportance = ImportanceScores
        ];

shared TimeSeriesAnalysis = (timeSeries as table, dateColumn as text, valueColumn as text) as record =>
    let
        // Data preparation with unknown functions
        SortedData = Table.Sort(timeSeries, dateColumn),
        DateParsed = Table.TransformColumns(SortedData, {{dateColumn, DateTime.From}}),
        // Time series decomposition with unknown functions
        Trend = UnknownTrendAnalyzer(DateParsed, dateColumn, valueColumn),
        Seasonality = UnknownSeasonalityDetector(DateParsed, dateColumn, valueColumn),
        Residuals = UnknownResidualCalculator(DateParsed, Trend, Seasonality),
        // Statistical analysis with unknown functions
        Stationarity = UnknownStationarityTest(DateParsed, valueColumn),
        AutoCorrelation = UnknownAutoCorrelationFunction(DateParsed, valueColumn),
        PartialAutoCorrelation = UnknownPartialAutoCorrelationFunction(DateParsed, valueColumn),
        // Anomaly detection with unknown functions
        Outliers = UnknownOutlierDetector(DateParsed, valueColumn),
        ChangePoints = UnknownChangePointDetector(DateParsed, valueColumn),
        AnomalyScores = UnknownAnomalyScorer(DateParsed, valueColumn),
        // Forecasting models with unknown functions
        ArimaModel = UnknownArimaModel(DateParsed, valueColumn),
        ExpSmoothingModel = UnknownExponentialSmoothingModel(DateParsed, valueColumn),
        ProphetModel = UnknownProphetModel(DateParsed, dateColumn, valueColumn),
        LstmModel = UnknownLSTMModel(DateParsed, valueColumn),
        // Model comparison with unknown functions
        ModelComparison = UnknownModelComparator({ArimaModel, ExpSmoothingModel, ProphetModel, LstmModel}),
        BestForecastModel = UnknownBestModelSelector(ModelComparison),
        // Forecasting with unknown functions
        ForecastHorizon = 30,
        Forecast = UnknownForecaster(BestForecastModel, ForecastHorizon),
        ConfidenceIntervals = UnknownConfidenceIntervalCalculator(Forecast),
        // Feature engineering with unknown functions
        LagFeatures = UnknownLagFeatureGenerator(DateParsed, valueColumn, {1, 7, 30}),
        RollingFeatures = UnknownRollingFeatureGenerator(DateParsed, valueColumn, {7, 14, 30}),
        CalendarFeatures = UnknownCalendarFeatureGenerator(DateParsed, dateColumn)
    in
        [
            Data = [
                Original = timeSeries,
                Processed = DateParsed,
                Features = LagFeatures & RollingFeatures & CalendarFeatures
            ],
            Decomposition = [
                Trend = Trend,
                Seasonality = Seasonality,
                Residuals = Residuals
            ],
            Statistics = [
                Stationarity = Stationarity,
                AutoCorrelation = AutoCorrelation,
                PartialAutoCorrelation = PartialAutoCorrelation
            ],
            Anomalies = [
                Outliers = Outliers,
                ChangePoints = ChangePoints,
                AnomalyScores = AnomalyScores
            ],
            Models = [
                ARIMA = ArimaModel,
                ExponentialSmoothing = ExpSmoothingModel,
                Prophet = ProphetModel,
                LSTM = LstmModel,
                Comparison = ModelComparison,
                Best = BestForecastModel
            ],
            Forecast = [
                Values = Forecast,
                ConfidenceIntervals = ConfidenceIntervals,
                Horizon = ForecastHorizon
            ]
        ];

shared NaturalLanguageProcessing = (textData as table, textColumn as text) as record =>
    let
        // Text preprocessing with unknown functions
        CleanedText = Table.TransformColumns(textData, {{textColumn, each UnknownTextCleaner(_)}}),
        Tokenized = Table.TransformColumns(CleanedText, {{textColumn, each UnknownTokenizer(_)}}),
        Normalized = Table.TransformColumns(Tokenized, {{textColumn, each UnknownTextNormalizer(_)}}),
        // Language detection with unknown functions
        Languages = Table.AddColumn(
            Normalized, "Language", each UnknownLanguageDetector(Record.Field(_, textColumn))
        ),
        // Linguistic analysis with unknown functions
        POSTags = Table.AddColumn(Languages, "POSTags", each UnknownPOSTagger(Record.Field(_, textColumn))),
        NamedEntities = Table.AddColumn(
            POSTags, "NamedEntities", each UnknownNamedEntityRecognizer(Record.Field(_, textColumn))
        ),
        Dependencies = Table.AddColumn(
            NamedEntities, "Dependencies", each UnknownDependencyParser(Record.Field(_, textColumn))
        ),
        // Semantic analysis with unknown functions
        Embeddings = Table.AddColumn(
            Dependencies, "Embeddings", each UnknownTextEmbedder(Record.Field(_, textColumn))
        ),
        Similarities = UnknownSemanticSimilarityCalculator(Embeddings, "Embeddings"),
        SemanticClusters = UnknownSemanticClusterer(Embeddings, "Embeddings"),
        // Sentiment analysis with unknown functions
        Sentiments = Table.AddColumn(
            Embeddings, "Sentiment", each UnknownSentimentAnalyzer(Record.Field(_, textColumn))
        ),
        Emotions = Table.AddColumn(Sentiments, "Emotions", each UnknownEmotionDetector(Record.Field(_, textColumn))),
        // Topic modeling with unknown functions
        TopicModel = UnknownTopicModeler(textData, textColumn),
        DocumentTopics = UnknownDocumentTopicAssigner(textData, TopicModel),
        TopicEvolution = UnknownTopicEvolutionAnalyzer(DocumentTopics),
        // Text classification with unknown functions
        Categories = Table.AddColumn(Emotions, "Categories", each UnknownTextClassifier(Record.Field(_, textColumn))),
        Intent = Table.AddColumn(Categories, "Intent", each UnknownIntentClassifier(Record.Field(_, textColumn))),
        // Information extraction with unknown functions
        KeyPhrases = Table.AddColumn(
            Intent, "KeyPhrases", each UnknownKeyPhraseExtractor(Record.Field(_, textColumn))
        ),
        Relationships = Table.AddColumn(
            KeyPhrases, "Relationships", each UnknownRelationshipExtractor(Record.Field(_, textColumn))
        ),
        // Text generation with unknown functions
        Summaries = Table.AddColumn(
            Relationships, "Summary", each UnknownTextSummarizer(Record.Field(_, textColumn))
        ),
        GeneratedQuestions = Table.AddColumn(
            Summaries, "Questions", each UnknownQuestionGenerator(Record.Field(_, textColumn))
        ),
        // Text quality metrics with unknown functions
        Readability = Table.AddColumn(
            GeneratedQuestions, "Readability", each UnknownReadabilityAnalyzer(Record.Field(_, textColumn))
        ),
        Complexity = Table.AddColumn(
            Readability, "Complexity", each UnknownComplexityAnalyzer(Record.Field(_, textColumn))
        ),
        // Statistical analysis with unknown functions
        TokenStats = UnknownTokenStatistics(textData, textColumn),
        VocabularyStats = UnknownVocabularyAnalyzer(textData, textColumn),
        NGramAnalysis = UnknownNGramAnalyzer(textData, textColumn, {2, 3, 4}),
        CollocationsAnalysis = UnknownCollocationAnalyzer(textData, textColumn)
    in
        [
            Data = [
                Original = textData,
                Cleaned = CleanedText,
                Processed = Complexity
            ],
            Linguistic = [
                Languages = Languages,
                POSTags = POSTags,
                NamedEntities = NamedEntities,
                Dependencies = Dependencies
            ],
            Semantic = [
                Embeddings = Embeddings,
                Similarities = Similarities,
                Clusters = SemanticClusters
            ],
            Sentiment = [
                Scores = Sentiments,
                Emotions = Emotions
            ],
            Topics = [
                Model = TopicModel,
                DocumentTopics = DocumentTopics,
                Evolution = TopicEvolution
            ],
            Classification = [
                Categories = Categories,
                Intent = Intent
            ],
            Extraction = [
                KeyPhrases = KeyPhrases,
                Relationships = Relationships
            ],
            Generation = [
                Summaries = Summaries,
                Questions = GeneratedQuestions
            ],
            Quality = [
                Readability = Readability,
                Complexity = Complexity
            ],
            Statistics = [
                Tokens = TokenStats,
                Vocabulary = VocabularyStats,
                NGrams = NGramAnalysis,
                Collocations = CollocationsAnalysis
            ]
        ];

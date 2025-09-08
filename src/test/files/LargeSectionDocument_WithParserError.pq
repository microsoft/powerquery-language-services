[Version = "1.0.0"]
section LargeSectionDocument_WithParserError;

// This is a complex M section document designed to test validation performance
// It contains parsing errors AND diagnostic errors

// Constants and basic values
BaseUrl = "https://api.example.com/v1/";
MaxRetries = 5;
DefaultTimeout = 30;

// Complex functions with parsing errors
shared ComplexFunction1 = (param1 as text, param2 as number, param3 as logical) as table =>
    let
        Source = UnknownTableFunction(param1, param2),
        Step1 = Table.AddColumn(Source, "NewCol", each UnknownScalarFunction([Column1], [Column2])),
        // Parsing error: missing closing parenthesis
        Step2 = Table.TransformColumns(Step1, {{"NewCol", each UnknownTransformFunction(_)}),
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
        // Parsing error: incorrect list syntax
        Aggregated = Table.Group(CombinedTable, {"Proc1"}, [{"Proc2Sum", each List.Sum([Proc2]), type number}]),
        Final = Table.AddColumn(Aggregated, "Calculated", each UnknownCalculation([Proc1], [Proc2Sum]))
    in
        Final;

shared ComplexFunction3 = (inputList as list, operations as list) as list =>
    let
        ProcessOperation = (current as list, operation as record) as list =>
            let
                OperationType = Record.Field(operation, "Type"),
                Parameter = Record.Field(operation, "Parameter")
            in
                if OperationType = "unknown1" then
                    List.Transform(current, each UnknownFunction1(_, Parameter))
                else if OperationType = "unknown2" then
                    List.Select(current, each UnknownFunction2(_, Parameter))
                else if OperationType = "unknown3" then
                    // Parsing error: malformed function call
                    List.Sort(current each UnknownFunction3(_, Parameter))
                else
                    current,
        Result = List.Accumulate(operations, inputList, ProcessOperation)
    in
        Result;

shared ComplexFunction4 = (textData as text, patterns as list) as record =>
    let
        ExtractPattern = (text as text, pattern as record) as any =>
            let
                PatternType = Record.Field(pattern, "Type"),
                PatternValue = Record.Field(pattern, "Value")
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
            // Parsing error: incorrect record syntax
            ProcessedResults = List.Transform(Results, each UnknownResultProcessor(_))
        
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
                // Parsing error: missing closing braces
                {"Count", each UnknownCountProcessor(_)
            }
        )
    in
        ProcessedStats;

// Additional functions with both parsing and diagnostic errors
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
        
        // Parsing error: incorrect list syntax
        Models = [
            LinearRegression = UnknownLinearRegression(TrainingSet, target),
            RandomForest = UnknownRandomForest(TrainingSet, target)
            XGBoost = UnknownXGBoost(TrainingSet, target),
            NeuralNetwork = UnknownNeuralNetwork(TrainingSet, target),
            SVM = UnknownSVM(TrainingSet, target)
        ],
        
        // Model evaluation with unknown functions
        Predictions = Record.TransformFields(
            Models,
            {
                "LinearRegression", each UnknownPredict(_, TestingSet),
                "RandomForest", each UnknownPredict(_, TestingSet),
                "XGBoost", each UnknownPredict(_, TestingSet),
                "NeuralNetwork", each UnknownPredict(_, TestingSet),
                "SVM", each UnknownPredict(_, TestingSet)
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
            FinalModel = FinalModel,
            FeatureImportance = ImportanceScores
        ];

[Version = "1.0.0"]
section LargeSectionDocument;

// This is a complex M section document designed to test validation performance
// It contains many functions and expressions - but NO parsing or diagnostic errors

// Constants and basic values
BaseUrl = "https://api.example.com/v1/";
MaxRetries = 5;
DefaultTimeout = 30;

// Complex mathematical functions
MathematicalOperations = [
    // Calculate moving average
    CalculateMovingAverage = (values as list, windowSize as number) as list =>
        let
            ValuesCount = List.Count(values),
            MovingAverages = List.Transform(
                List.Numbers(0, ValuesCount - windowSize + 1),
                (index) =>
                    let
                        WindowValues = List.Range(values, index, windowSize),
                        Average = List.Average(WindowValues)
                    in
                        Average
            )
        in
            MovingAverages,
    
    // Calculate standard deviation  
    CalculateStandardDeviation = (values as list) as number =>
        let
            Count = List.Count(values),
            Mean = List.Average(values),
            SquaredDifferences = List.Transform(values, each Number.Power(_ - Mean, 2)),
            Variance = List.Sum(SquaredDifferences) / (Count - 1),
            StandardDeviation = Number.Sqrt(Variance)
        in
            StandardDeviation
];

// Main data processing functions
shared LargeSectionDocument.CalculateStatistics = (data as list) as record =>
    [
        MovingAverage = MathematicalOperations[CalculateMovingAverage](data, 5),
        StandardDeviation = MathematicalOperations[CalculateStandardDeviation](data),
        Mean = List.Average(data),
        Median = List.Median(data),
        Min = List.Min(data),
        Max = List.Max(data)
    ];

// Additional complex functions to increase processing time
shared ComplexFunction1 = (param1 as text, param2 as number, param3 as logical) as table =>
    let
        Source = #table({"Column1", "Column2", "Column3"}, {{param1, param2, param3}}),
        Step1 = Table.AddColumn(Source, "NewCol", each Text.Length([Column1]) + [Column2]),
        Step2 = Table.TransformColumns(Step1, {{"NewCol", each _ * 2}}),
        Step3 = Table.SelectRows(Step2, each [Column3] = param3),
        Result = Table.Sort(Step3, {{"NewCol", Order.Descending}})
    in
        Result;

shared ComplexFunction2 = (data as table, config as record) as table =>
    let
        ColumnNames = Table.ColumnNames(data),
        FirstColumn = Table.Column(data, ColumnNames{0}),
        SecondColumn = if List.Count(ColumnNames) > 1 then Table.Column(data, ColumnNames{1}) else {},
        Processed1 = List.Transform(FirstColumn, each Text.From(_)),
        Processed2 = List.Transform(SecondColumn, each Number.From(_)),
        CombinedTable = #table({"Proc1", "Proc2"}, List.Zip({Processed1, Processed2})),
        Aggregated = Table.Group(CombinedTable, {"Proc1"}, {{"Proc2Sum", each List.Sum([Proc2]), type number}}),
        Final = Table.AddColumn(Aggregated, "Calculated", each [Proc1] & " = " & Text.From([Proc2Sum]))
    in
        Final;

shared ComplexFunction3 = (inputList as list, operations as list) as list =>
    let
        ProcessOperation = (current as list, operation as record) as list =>
            let
                OperationType = Record.Field(operation, "Type"),
                Parameter = Record.Field(operation, "Parameter")
            in
                if OperationType = "transform" then
                    List.Transform(current, each _ + Parameter)
                else if OperationType = "filter" then
                    List.Select(current, each _ > Parameter)
                else if OperationType = "sort" then
                    List.Sort(current)
                else
                    current,
        Result = List.Accumulate(operations, inputList, ProcessOperation)
    in
        Result;

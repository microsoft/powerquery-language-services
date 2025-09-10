[Version="3.3.37"]
section Kusto;

// Keep in sync with section Version declaration.
connectorVersion = "3.3.37";

NormalizeUrl = (url as text) =>
    let 
        normalizedUrl = if Text.StartsWith(url, "https://", Comparer.FromCulture("en-us", true)) then url 
            else if Text.StartsWith(url, "http://", Comparer.FromCulture("en-us", true)) then error Error.Record("DataSource.Error", Extension.LoadString("Errors.HttpsOnly"))
            else ("https://" & url & (if (Text.EndsWith(url, ".kusto.windows.net") or Text.EndsWith(url, ".kusto.azuresynapse.net")) then "" else ".kusto.windows.net")),
        hostname = Uri.Parts(normalizedUrl)[Host],
        isSupportedHostname = List.MatchesAny(SupportedUrlHostnames, (supportedHostname) => Text.EndsWith(hostname, supportedHostname[Prefix], Comparer.OrdinalIgnoreCase)),
        validatedUrl = 
            if (isSupportedHostname) then normalizedUrl
            else error Error.Record("DataSource.Error", Extension.LoadString("Errors.AdxOnly"))
    in
        validatedUrl;

NormalizeResourceUrl = (url as text) => 
    let 
        normalizedUrl = if Text.StartsWith(url, "https://", Comparer.FromCulture("en-us", true)) then url 
            else if Text.StartsWith(url, "http://", Comparer.FromCulture("en-us", true)) then error Error.Record("DataSource.Error", Extension.LoadString("Errors.HttpsOnly"))
            else ("https://" & url & (if (Text.EndsWith(url, ".kusto.windows.net") or Text.EndsWith(url, ".kusto.azuresynapse.net")) then "" else ".kusto.windows.net")),
        urlParts = Uri.Parts(normalizedUrl),
        hostname = urlParts[Host],
        allSupportedHostnameDetails = List.Select(SupportedUrlHostnames, (supportedHostname) => Text.EndsWith(hostname, supportedHostname[Prefix], Comparer.OrdinalIgnoreCase)),
        supportedHostnameDetails = List.First(allSupportedHostnameDetails),

        resource = supportedHostnameDetails[Resource],

        combinedUrl = if (resource is text) then resource
            else if (resource is number) then "https://kusto." & Text.Combine(List.LastN(Text.Split(hostname, "."), resource), ".")
            else if (resource = null) then "https://kusto." & Text.Combine(List.Skip(Text.Split(hostname, "."), 1), ".")
            else if (resource is function) then resource(hostname)
            else error Error.Record("DataSource.Error", Extension.LoadString("Errors.AdxOnly"))
    in
        combinedUrl;

valueOrDefault = (value, default) => if (value <> null) then value else default;
coalesce = (values as list) => List.First(List.RemoveNulls(values));

BuildQueryUrl = (clusterUrl as text, optional queryString as record) => 
    let
        // Ensure ClusterUrl ends with a /
        clusterUrlWithSlash = Text.TrimEnd(clusterUrl, "/") & "/",

        // | Base | Path | Uri.Combine
        // |---|---|---
        // | https://www.microsoft.com                    | relative/path  | https://www.microsoft.com/relative/path
        // | https://www.microsoft.com                    | /absolute/path | https://www.microsoft.com/absolute/path
        // | https://www.www.microsoft.com/               | relative/path  | https://www.www.microsoft.com/relative/path
        // | https://www.www.microsoft.com/               | /absolute/path | https://www.www.microsoft.com/absolute/path
        // | https://www.microsoft.com/originalPath       | relative/path  | https://www.microsoft.com/relative/path
        // | https://www.microsoft.com/originalPath       | /absolute/path | https://www.microsoft.com/absolute/path
        // | https://www.microsoft.com/originalPath/      | relative/path  | https://www.microsoft.com/originalPath/relative/path
        // | https://www.microsoft.com/originalPath/      | /absolute/path | https://www.microsoft.com/absolute/path
        // | https://www.microsoft.com/originalPath/plus  | relative/path  | https://www.microsoft.com/originalPath/relative/path
        // | https://www.microsoft.com/originalPath/plus  | /absolute/path | https://www.microsoft.com/absolute/path
        // | https://www.microsoft.com/originalPath/plus/ | relative/path  | https://www.microsoft.com/originalPath/plus/relative/path
        // | https://www.microsoft.com/originalPath/plus/ | /absolute/path | https://www.microsoft.com/absolute/path
        url = Uri.Combine(clusterUrlWithSlash, "v1/rest/query"),
        query = Uri.BuildQueryString(queryString)
    in
        if (queryString <> null) then
            url & "?" & query
        else
            url;

BlobWithSas.Contents = (url as text, token as text) =>
    Extension.InvokeWithCredentials(
        // Return credential record to use.
        (datasource) => [ AuthenticationKind = "SAS", Token = token ],
        // Data source access call
        () => AzureStorage.BlobContents(url)
    );

NormalizeQuery = (query as text) => NormalizeQueryImpl(query);
NormalizeQueryImpl = (query as text) => 
    let 
        trimmed = Text.Trim(query),
        trimmed1 = Text.Trim(trimmed, ";")
    in
        if (trimmed1 <> query) then NormalizeQuery(trimmed1) else trimmed1;

GetNavForDatabase = (cluster as text, database as text, optional options as record) as table =>
    let
        kustoTables = _Kusto.Tables(cluster, database, options),
        expanded = Table.FromRecords(kustoTables, {"Name", "ItemKind", "Parameters"}, MissingField.UseNull),
        renamedItemKind = Table.RenameColumns(expanded, {"ItemKind", "originalItemKind"}),
        withItemName = Table.AddColumn(renamedItemKind, "originalItemName", each
            if [Parameters] = null then
                [originalItemKind]
            else if Record.FieldCount([Parameters]) = 0 then
                "Table"
            else
                null
        ),
        withData = Table.AddColumn(withItemName, "Data", each
            if [Parameters] = null or [Parameters] = [] then
                _Kusto.SmartQuery(cluster, database, NormalizeColumnName([Name]), options)
            else
                FunctionQuery(cluster, database, [Name], [Parameters], options),
            type table
        )
    in
        Table.NavigationTableView(
            () => withData,
            {"Name"},
            (name) =>
                let
                    updatedOptions = Record.RemoveFields(options ?? [], "AdditionalSetStatements", MissingField.Ignore),
                    functionRow = _Kusto.Schema(cluster, database, ".show functions", GetClientActivityId(), updatedOptions, /* customSchema */ true){[Name = name]}?,
                    fnParameters = FunctionParser(functionRow[Parameters], functionRow[DocString])
                in
                    if Text.StartsWith(name, "external_table('") or functionRow = null or functionRow = [] or fnParameters = [] then
                        _Kusto.SmartQuery(cluster, database, NormalizeColumnName(name), options)
                    else
                        FunctionQuery(cluster, database, name, fnParameters, options),
            [
                Name = "Name",
                Data = each [Data],
                ItemKind = each [originalItemKind],
                ItemName = each [originalItemName],
                IsLeaf = each true
            ],
            [
                // TODO: Do we need to check the structure and types of the incoming rows?
                OnInsertRows = (tablesToInsert as table) =>
                    let
                        existingTables = _Kusto.Tables(cluster, database, options, /* tablesOnly */ true),
                        namesOnly = List.Buffer(List.Transform(existingTables, each _[Name])),
                        tableExists = Table.AddColumn(tablesToInsert, "TableExists", each List.Contains(namesOnly, [Name]), type logical),
                        insertDataActions = Table.AddColumn(tableExists, "InsertData", (r) =>
                            let
                                newTableRef = _Kusto.SmartQuery(cluster, database, r[Name])
                            in
                                TableAction.InsertRows(newTableRef, r[Data])),
                        finalActions = Table.AddColumn(insertDataActions, "Actions", (r) =>
                            if (r[TableExists]) then
                                // TODO: Return Action.DoNothing if the table being inserted is empty and has the same schema as the existing table
                                error Table.ViewError(
                                    Error.Record(
                                        "Expression.Error",
                                        "Table already exists.",
                                        [ Name = r[Name] ]
                                    )
                                )
                            else
                                Action.Sequence({
                                    CreateTable(cluster, database, r[Name], r[Data]),
                                    r[InsertData]
                                })
                        )
                    in
                        try Action.Sequence(finalActions[Actions] & { Action.Return(tablesToInsert) }) catch (e) => error Table.ViewError(e),
                OnNativeQuery = (query, parameters, options) =>
                    if options = null and (parameters = null or parameters = []) then
                        _Kusto.SmartQuery(cluster, database, query, options)
                    else
                        ...,
                OnInvoke = (function, args, index) =>
                    if (function = Value.Versions) then
                        GetKustoDatabaseVersions(
                            cluster,
                            database,
                            () => @GetNavForDatabase(cluster, database, options)
                        )
                    else
                        ...
            ]
        );

GetNavForCluster = (cluster as text, optional options as record) as table =>
    let
        allDatabases = _Kusto.Databases(cluster, options),
        expanded = Table.FromRecords(allDatabases, {"Name", "ItemKind"}, MissingField.UseNull),
        renamed = Table.RenameColumns(expanded, {{"ItemKind", "originalItemKind"}}),
        withData = Table.AddColumn(renamed, "Data", each GetNavForDatabase(cluster, [Name], options), type table)
    in
        Table.NavigationTableView(
            () => withData,
            {"Name"},
            (db) => GetNavForDatabase(cluster, db, options),
            [
                Name = "Name",
                Data = each [Data],
                ItemKind = each [originalItemKind],
                ItemName = each [originalItemKind],
                IsLeaf = each false
            ]
        );

GetClientActivityId = () => 
    let 
        rootActivityId = if (Diagnostics.ActivityId <> null) then Text.From(Diagnostics.ActivityId()) else Text.NewGuid(),
        activityId = Text.NewGuid()
    in
        "KPBI;" & rootActivityId & ";" & activityId;

_Kusto.Contents = (cluster as text, optional database as text, optional table as text, optional options as record) =>
    if (table <> null and database = null) then
        error "database parameter must be specified when specifying a table value"
    else if (table <> null) then
        _Kusto.SmartQuery(cluster, database, table, options)
    else if (database <> null) then
        GetNavForDatabase(cluster, database, options)
    else
        GetNavForCluster(cluster, options);

RefreshTokenAsNeeded = () => 
    let
        DecodeBase64Url = (string as text) as binary =>
            Binary.FromText(Text.Replace(Text.Replace(string, "-", "+"), "_", "/") & {"", "", "==", "="}{Number.Mod(Text.Length(string), 4)}, BinaryEncoding.Base64),

        DateTimeFromUnixTimeStamp = (timestamp as number) as datetimezone =>
            #datetimezone(1970, 1, 1, 0, 0, 0, 0, 0) + #duration(0, 0, 0, timestamp),

        GetTokenTtl = (token as text) as duration =>
            let
                payloadEncoded = Text.Split(token, "."){1},
                payload = Json.Document(Text.FromBinary(DecodeBase64Url(payloadEncoded))),
                expires = DateTimeFromUnixTimeStamp(payload[exp])
            in
                expires - DateTimeZone.UtcNow(),

        IsTokenValid = (token as text) as logical =>
            if Diagnostics.LogValue2("TokenTtl", GetTokenTtl(token)) > #duration(0, 0, 30, 0) then true
            else not Record.HasFields(Extension.CurrentCredential(true), {"Doesn't exist"}), // Force call to refresh
        
        AccessToken = Extension.CurrentCredential(false)[access_token]
    in
        IsTokenValid(AccessToken);

WebRequest = (url as text, options as record) =>
    let
        content = Web.Contents(url, options & [ManualStatusHandling = {400, 401, 403, 404, 408, 500, 504}]),
        json = try Json.Document(content) otherwise null,

        // We force evaluation of content before checking metadata values to avoid
        // the request being issued a second time.
        HasContinuation = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-continuation-NextPartitionKey",null),
        httpStatus = Value.Metadata(content)[Response.Status],
        errorResponse =
            if (httpStatus = 400) then
                error Error.Record(
                    "Bad request",
                    Record.FieldOrDefault(json[error]?, "@message") ?? json[error]?[message]? ?? "Bad request",
                    [
                        Error = Record.FieldOrDefault(json[error]?, "@message") ?? json[error]?[message]?,
                        Code = Record.FieldOrDefault(json[error]?, "code"),
                        Type = Record.FieldOrDefault(json[error]?, "@type"),
                        #"x-ms-activity-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-activity-id"),
                        #"x-ms-client-request-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-client-request-id")
                    ]
                )
            else if (httpStatus = 401 or httpStatus = 403) then
                error Extension.CredentialError(
                    if (httpStatus = 401) then Credential.AccessDenied else Credential.AccessForbidden,
                    Record.FieldOrDefault(json, "Message", "AccessDenied"),
                    [
                        #"x-ms-activity-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-activity-id"),
                        #"x-ms-client-request-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-client-request-id")
                    ]
                )
            else if (httpStatus = 404) then
                error Error.Record(
                    "DataSource.NotFound",
                    null,
                    [
                        #"x-ms-activity-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-activity-id"),
                        #"x-ms-client-request-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-client-request-id")
                    ]
                )
            else if (httpStatus = 408 or httpStatus = 504) then
                let
                    // Take the first error message that is not null
                    errorMessage = 
                        if (json <> null) then List.First(List.RemoveNulls({ json[error]?[message]?, json[Message]? }), null) 
                        else if (httpStatus = 408) then "Request Timeout"
                        else "Gateway Timeout"
                in
                    error Error.Record(
                        "DataSource.Timeout",
                        errorMessage,
                        [
                            #"x-ms-activity-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-activity-id"),
                            #"x-ms-client-request-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-client-request-id")
                        ]
                    )
            else if (httpStatus >= 400) then
                let
                    // Take the first error message that is not null
                    errorMessage = 
                        if (json <> null) then List.First(List.RemoveNulls({ json[error]?[message]?, json[Message]? }), null) 
                        else "Bad Request"
                in
                    error Error.Record(
                        "DataSource.Error",
                        errorMessage,
                        [
                            #"x-ms-activity-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-activity-id"),
                            #"x-ms-client-request-id" = Record.FieldOrDefault(Value.Metadata(content)[Headers], "x-ms-client-request-id")
                        ]
                    )
            else
                null
    in
       if (Diagnostics.LogValue2("Has Continuation Token", HasContinuation) <> null) then valueOrDefault(errorResponse, json)
       else valueOrDefault(errorResponse, json); 

_Kusto.Databases = (cluster as text, optional options as record) as list =>
    let
        updatedOptions = Record.RemoveFields(options ?? [], "AdditionalSetStatements", MissingField.Ignore),
        RowsList = _Kusto.Query(cluster, "NetDefaultDB", ".show databases", GetClientActivityId(), updatedOptions),
        FirstColumnValues = List.Distinct(Table.TransformRows(RowsList, (r) => [ Name = r[DatabaseName], ItemKind = "Database"]))
    in
        FirstColumnValues;
            
_Kusto.Tables = (cluster as text, database as text, optional options as record, optional tablesOnly as logical) as list =>
    let
        updatedOptions = Record.RemoveFields(options ?? [], "AdditionalSetStatements", MissingField.Ignore),
        
        Tables = _Kusto.Query(cluster, database, ".show tables", GetClientActivityId(), updatedOptions),
        TablesNames = List.Distinct(Table.TransformRows(Tables, (r) => [ Name = r[TableName], ItemKind = "Table"])),

        ExternalTables = _Kusto.Query(cluster, database, ".show external tables", GetClientActivityId(), updatedOptions),
        ExternalTablesNames = List.Distinct(Table.TransformRows(ExternalTables, (r) => [ Name = "external_table('" & r[TableName] & "')", ItemKind = "View"])),

        MaterializedViews = _Kusto.Query(cluster, database, ".show materialized-views", GetClientActivityId(), updatedOptions),
        MaterializedViewsNames = List.Distinct(Table.TransformRows(MaterializedViews, (r) => [ Name = r[Name], ItemKind = "View"])),

        Functions = _Kusto.Query(cluster, database, ".show functions", GetClientActivityId(), updatedOptions),
        FunctionsNamesWithNulls = Table.TransformRows(Functions, (r) => [ Name = r[Name], ItemKind = "Function", Parameters = FunctionParser(r[Parameters], r[DocString])]),
        FunctionsNames = List.Select(FunctionsNamesWithNulls, each try Record.Field(_, "Parameters") is any otherwise false)
    in
        if (tablesOnly = true) then
            TablesNames
        else
            List.Combine({
                TablesNames,
                ExternalTablesNames,
                MaterializedViewsNames,
                FunctionsNames});

QueryFunctionReturnType = (cluster as text, database as text, name as text) =>
    let
        schema = Json.Document(_Kusto.Schema(cluster, database, ".show function " & NormalizeColumnName(name) & " schema as json", GetClientActivityId(), [], true){0}[Schema]),
        scalarReturnType = schema[OutputColumns]{0}[Type],
        tableReturnColumns = schema[OutputColumns],
        pqType =
            if schema[FunctionKind] = "ScalarFunction" then
                TypeMap{[DataType = scalarReturnType]}[Type]
            else
                type table Type.ForRecord(Record.FromList(List.Transform(tableReturnColumns, each [Type = TypeMap{[DataType = [Type]]}[Type], Optional = false]), List.Transform(tableReturnColumns, each [Name])), false)
    in
        try pqType otherwise type table; //schema kusto query may fail for some functions if static analysis fails


FunctionQuery = (cluster as text, database as text, name as text, parameters as record, options as nullable record) =>
    let
        functionReturnType = QueryFunctionReturnType(cluster, database, name),
        functionType = Type.ForFunction([Parameters=parameters[Parameters], ReturnType = type any], parameters[MinArguments])
            meta [Kusto.Query=[Query=name, Cluster=cluster, Database=database], Documentation.Name=name, Documentation.Description=parameters[DocString]], //Kusto.Query is used fold kusto function calls when used in the context of another kusto query
        emptyTableSchema = Table.Schema(#table(0, {})),
        fn = Function.From(functionType, fnHandler),
        fnHandler = (args) =>
            let
                argsAndType = List.Zip({args, Record.FieldValues(parameters[Parameters])}), //Note: if optional parameters, length of lists will differ
                isTable = Type.Is(functionReturnType, type table),
                query = (if isTable then "" else "print ") & name & 
                    "(" & 
                    Text.Combine(
                        List.Transform(
                            argsAndType, 
                            (argAndType) => 
                                let
                                    arg = argAndType{0},
                                    argPreviousMetadata = Value.Metadata(arg),
                                    argMetaData = (if not (argPreviousMetadata is record) then [] else argPreviousMetadata) & [ValueType=Value.Metadata(argAndType{1})[KustoType]],
                                    kustoExpression = escapeValue(emptyTableSchema, arg meta argMetaData)
                                in
                                    if argAndType{1} = type any then
                                        "dynamic(" & kustoExpression & ")" //Does not support table parameter on purpose to avoid trying to serialize a large table into a query.
                                    else 
                                        kustoExpression
                        ),
                        ", ") &
                    ")",
                result = _Kusto.SmartQuery(cluster, database, query, options),
                unpacked = if Type.Is(functionReturnType, type table) then result else result{0}[print_0]
            in
                unpacked
    in
        fn;
    
NormalizeColumnName = (name as text) as text => 
    let
        normalizedName = if (name = "" or name = null or Text.StartsWith(name, "external_table('")) then
                                name
                            else
                                "[""" & Text.Replace(Text.Replace(name, "\", "\\"), """", "\""") & """]"
    in
        normalizedName;
    
Expressions = (context, expression) => 
    let 
        // Dummy functions placeholders, used to negate their matching functions
        Text.NotContains = () => {},
        Text.NotEndsWith = () => {},
        Text.NotStartsWith = () => {},
        List.NotContains = () => {},
        Value.NotEquals = () => {},
        Value.NotNullableEquals = () => {},

        return = (value) => value,

        GetContext = (expr) => let 
            context = Value.Metadata(expr)[Kusto.Context]?
            in
                valueOrDefault(context, []),
        SetContext = (expr, context) => expr meta [Kusto.Context = context],
        WithAggregationContext = (context, result) =>
            if (context[QueryContext]? = "Aggregation") then result
            else error "Aggregation function not supported in this context",

        // Main expression handling based on its kind
        handleExpr = (context, expr)  => 
            let 
                kind = expr[Kind]
            in
                if (expr = RowExpression.Row) then SetContext("#{0}", context)
                else if (kind = "Unary") then unaryExpr(context, expr)
                else if (kind = "Binary") then binaryExpr(context, expr)
                else if (kind = "If") then ifExpr(context, expr)
                else if (kind = "FieldAccess") then fieldAccessExpr(context, expr)
                else if (kind = "ElementAccess") then elementAccessExpr(context, expr)
                else if (kind = "Identifier") then identifierExpr(context, expr)
                else if (kind = "Constant") then constantExpr(context, expr)
                else if (kind = "Invocation") then invocationExpr(context, expr)
                else ..., 

        // Handles Unary operators
        unaryExpr = (context, x) => 
                let 
                    operator = x[Operator],
                    innerExpr = x[Expression],
                    expressionKind = innerExpr[Kind],
                    expr = if (operator = "Not") then invertExpression(context, innerExpr)
                        else if (operator = "Negative") then "-(" & handleExpr(context, innerExpr) & ")" 
                        else handleExpr(context, innerExpr)
                in 
                    Diagnostics.LogValue2("Unary", expr),

        // Handles Binary operators
        binaryExpr = (context, x) => 
            let 
                op = operatorExpr(x[Operator]),
                left = handleExpr(context, x[Left]),
                right = handleExpr(context, x[Right]),

                isLeftNull = Value.Metadata(left)[IsNull]?,
                isRightNull = Value.Metadata(right)[IsNull]?,

                bracketedLeft = if (isLeftNull <> true and comparePrecedence(left, right) < 0) then "(" & left & ")" else left,
                bracketedRight = if (isRightNull <> true and comparePrecedence(left, right) > 0) then "(" & right & ")" else right,

                caseInsensitive = context[CaseInsensitive]?,

                format = if (op = "&") then "strcat(#{0}, #{2})" meta [ ValueType = "string" ] // TODO: Optimize multiple concatenations strcat(strcat("a", "b"), "c") => strcat("a", "b", "c")
                    else if (isRightNull = true and op = "==") then "isnull(#{0})" meta [ ValueType = "bool" ]
                    else if (isRightNull = true  and op = "!=") then "isnotnull(#{0})" meta [ ValueType = "bool" ]
                    else if (isLeftNull = true  and op = "==") then "isnull(#{2})" meta [ ValueType = "bool" ]
                    else if (isLeftNull = true  and op = "!=") then "isnotnull(#{2})" meta [ ValueType = "bool" ]
                    else if (caseInsensitive = true) then
                        if ((op = "==") and (isOfType(left, "string") or isOfType(right, "string"))) then "#{0} =~ #{2}" meta [ ValueType = "bool" ]
                        else if ((op = "!=") and (isOfType(left, "string") or isOfType(right, "string"))) then "#{0} !~ #{2}" meta [ ValueType = "bool" ]
                        // TODO: Use a case-insensitive function instead of tolower() once it's available in KQL
                        else if ((op = "==" or op = "!=" or op = "<" or op = "<=" or op = ">" or op = ">=") and (isOfType(left, "string") or isOfType(right, "string"))) then "strcmp(tolower(#{0}), tolower(#{2})) #{1} 0" meta [ ValueType = "bool" ]
                        else "(#{0}) #{1} (#{2})" 
                    else if ((op = "==" or op = "!=") and isOfType(left, "string") and isOfType(right, "string")) then "#{0} #{1} #{2}" meta [ ValueType = "bool" ]
                    else if ((op = "==" or op = "!=" or op = "<" or op = "<=" or op = ">" or op = ">=") and (isOfType(left, "string") or isOfType(right, "string"))) then "strcmp(#{0}, #{2}) #{1} 0" meta [ ValueType = "bool" ]
                    else if (op = "==" or op = "!=" or op = "<" or op = "<=" or op = ">" or op = ">=") then "(#{0}) #{1} (#{2})" meta [ ValueType = "bool" ]
                    else "(#{0}) #{1} (#{2})"
            in 
                Diagnostics.LogValue2("Binary", Text.Format(format, { bracketedLeft, op, bracketedRight}) meta [ 
                    Precedence = precedence(op), 
                    ValueType = chooseTypeWithOperator(format, left, right)
                ]),

        // Handles If statements
        ifExpr = (context, x) => 
            let 
                cond = handleExpr(context, x[Condition]),
                left = handleExpr(context, x[TrueCase]),
                right = handleExpr(context, x[FalseCase]),

                leftType = getType(left),
                rightType = getType(right),

                finalType = Diagnostics.LogValue2("finalType", chooseType(left, right)),
                // prepend "to" to the left/right legs, to get a "toXXX()" function call
                leftFormat = if (finalType <> null) then 
                        if (finalType = "string" and leftType = finalType and rightType = finalType) then "#{0}" else ("to" & finalType & "(#{0})")
                        else "#{0}",
                rightFormat = if (finalType <> null) then 
                        if (finalType = "string" and leftType = finalType and rightType = finalType) then "#{0}" else ("to" & finalType & "(#{0})")
                        else "#{0}"
            in 
                Diagnostics.LogValue2("If", Text.Format("iff(#{0}, #{1}, #{2})", { 
                    cond, 
                    Text.Format(leftFormat, { left }), 
                    Text.Format(rightFormat, { right }) }) meta [ ValueType = finalType ]),

        // Handles Field Access expressions
        fieldAccessExpr = (context, e) => 
            // verify the expr is returning a row context
            // return a column context for further expressions
            let 
                expr = handleExpr(context, e[Expression]),
                exprContext = GetContext(expr),
                columnName = NormalizeColumnName(e[MemberName]),

                columns = context[Columns]?,
                column = List.First(List.Select(columns, (c) => c[Name] = e[MemberName])),

                result = if (columns <> null) then SetContext(columnName meta [ ValueType = ConvertType(column[TypeName]) ], exprContext & [ Kind = "Column" ])
                    else error "Field/column access not supported in this context"
            in
                Diagnostics.LogValue2("FieldAccess", result),
    
        // Handles Element Access expressions
        elementAccessExpr = (context, x) => 
            let
                rec = 
                [
                    Kind = "ElementAccess",
                    Key = handleExpr(context, x[Key]),
                    Collection = handleExpr(context, x[Collection])
                ]
            in 
                Diagnostics.LogValue2("ElementAccess", Text.Format("(#{0}[#{1})", { rec[Collection], rec[Key] }) meta [Precedence = -1]),

        // Handles Identifier expressions
        identifierExpr = (context, x) =>
            let rec = 
                [
                    Kind = "Identifier",
                    Key = x[Name]
                ]
            in
                Diagnostics.LogValue2("Identifier", SetContext(rec[Name], context)),

        // Handles Constants expressions
        constantExpr = (context, x) => 
            let 
                value = escapeValue(context, x[Value]),

                isString = if (x[Value] is text) then true else false,
                valueMeta = Value.Metadata(value) & [Precedence = -1, IsString = isString]
            in
                Diagnostics.LogValue2("Constant", SetContext(value meta valueMeta, context)),

        chooseType = (leftExpression, rightExpression) =>
            let
                leftMetadata = try Value.Metadata(leftExpression),
                rightMetadata = try Value.Metadata(rightExpression),
                leftMetadata2 = if (leftMetadata[HasError]) then [] else leftMetadata[Value],
                rightMetadata2 = if (rightMetadata[HasError]) then [] else rightMetadata[Value],
                leftValueType = leftMetadata2[ValueType]?,
                rightValueType = rightMetadata2[ValueType]?,
                leftIsNull = leftMetadata2[IsNull]?,
                rightIsNull = rightMetadata2[IsNull]?
            in
                // Both are the same and not null, use their value
                if (leftValueType <> null and leftValueType = rightValueType) then leftValueType

                else if (leftValueType = "int" and rightValueType = "real") then "real"
                else if (leftValueType = "real" and rightValueType = "int") then "real"
                
                // One is null, the other isn't - use the not-null
                else if (leftValueType = null and rightValueType <> null) then rightValueType
                else if (leftValueType <> null and rightValueType = null) then leftValueType
                
                // One is string, the other isn't - use string
                else if (leftValueType <> null and rightValueType = "string") then "string"
                else if (leftValueType = "string" and rightValueType <> null) then "string"
                
                else if (leftValueType <> null and rightValueType <> null) then 
                    if (leftIsNull = true) then rightValueType
                    else if (rightIsNull = true) then leftValueType
                    else null
                else null,

        chooseTypeWithOperator = (operatorExpression, leftExpression, rightExpression) =>
            let
                operatorValueType = Value.Metadata(operatorExpression)[ValueType]?,
                leftValueType = Value.Metadata(leftExpression)[ValueType]?,
                rightValueType = Value.Metadata(rightExpression)[ValueType]?
            in
                valueOrDefault(operatorValueType, chooseType(leftExpression, rightExpression)),

        isOfType = (expression, expectedType as text) =>
            let
                valueType = Value.Metadata(expression)[ValueType]?
            in
                valueType = expectedType,

        getType = (expression) =>
            let
                valueType = Value.Metadata(expression)[ValueType]?
            in
                valueType,

        // Handles Function Invocations expressions
        invocationExpr = (context, x) => 
            let 
                rec = 
                [
                    Kind = "Invocation",
                    FunctionFormat = functionFormatExpr(context, x),
                    Arguments = List.Transform(x[Arguments], (a) => handleExpr(context, a))
                ],
                // Propagate the function and args flag up the call stack
                formatContext = GetContext(rec[FunctionFormat]),
                ArgsContext = List.Accumulate(rec[Arguments], [], (c, a) => c & GetContext(a)),
                finalContext = ArgsContext & formatContext,
                txt = Text.Format(rec[FunctionFormat], rec[Arguments])
            in 
                Diagnostics.LogValue2("Invocation", SetContext(txt, finalContext)),

        //Invert expression based on inner expression kind
        invertExpression = (context, x) =>
            let
                kind = x[Kind],
                expr = if (kind = "Binary") then (
                            // Implementing DeMorgan law to negate left/right branches, and invert operator
                            if (x[Operator] = "And" or x[Operator] = "Or") then 
                                let
                                    Left = @invertExpression(context, x[Left]),
                                    Right = @invertExpression(context, x[Right]),
                                    Operator = if (x[Operator] = "And") then "or" else "and"
                                in
                                    Diagnostics.LogValue2("InvertExpression:Binary", Text.Format("(#{0} #{1} #{2})", {Left, Operator, Right}))
                            else // Invert operator in case of <, <=, >, >=, ==, <>
                                let
                                    newExpr = [
                                        Kind = x[Kind],
                                        Left = x[Left],
                                        Right = x[Right],
                                        Operator = 
                                            if (x[Operator] = "Equals") then "NotEquals" 
                                            else if (x[Operator] = "NotEquals") then "Equals" 
                                            else if (x[Operator] = "GreaterThan") then "LessThanOrEquals" 
                                            else if (x[Operator] = "GreaterThanOrEquals") then "NotEquals" 
                                            else if (x[Operator] = "LessThan") then "GreaterThanOrEquals" 
                                            else if (x[Operator] = "LessThanOrEquals") then "GreaterThan" 
                                            // TODO: Need to decide what to do here
                                            else ...
                                    ]
                                in
                                    Diagnostics.LogValue2("InvertExpression:Operator", handleExpr(context, newExpr))
                        )
                        
                        // Replace Function to enable smart "negative" function calls (such as !startwith, !has, etc.)
                        else if (kind = "Invocation") then
                            let
                                newExpr = 
                                    [
                                        Kind = kind,
                                        Arguments = x[Arguments],
                                        Function = [
                                            Kind = "Constant",
                                            Value = if (x[Function][Value] = Text.Contains) then Text.NotContains 
                                                    else if (x[Function][Value] = Text.EndsWith) then Text.NotEndsWith 
                                                    else if (x[Function][Value] = Text.StartsWith) then Text.NotStartsWith 
                                                    else if (x[Function][Value] = List.Contains) then List.NotContains 
                                                    else if (x[Function][Value] = Value.Equals) then Value.NotEquals 
                                                    else if (x[Function][Value] = Value.NullableEquals) then Value.NotNullableEquals
                                                    else ...
                                        ]
                                    ]
                            in
                                Diagnostics.LogValue2("InvertExpression:Invocation", handleExpr(context, newExpr))

                        // Apply "not()" on the provided expression
                        else if (kind = "Unary") then
                            let
                                Value = handleExpr(context, x)
                            in
                                Diagnostics.LogValue2("InvertExpression:Unary", Text.Format("not (#{0})", {Value}))
                        
                        else
                            ...

            in
                SetContext(expr, context),

        // Convert Operator from Name to "sign"
        operatorExpr = (x) => 
            let op =
                    if (x = "Equals") then return("==" meta [Precedence = 0]) 
                    else if (x = "NotEquals") then return("!=" meta [Precedence = 1])
                    else if (x = "GreaterThan") then return(">" meta [Precedence = 2])
                    else if (x = "GreaterThanOrEquals") then return(">=" meta [Precedence = 3])
                    else if (x = "LessThan") then return("<" meta [Precedence = 4])
                    else if (x = "LessThanOrEquals") then return("<=" meta [Precedence = 5])
                    else if (x = "And") then return("and" meta [Precedence = 6])
                    else if (x = "Or") then return("or" meta [Precedence = 7])
                    else if (x = "Not") then return("not" meta [Precedence = 8])
                    else if (x = "Add") then return("+" meta [Precedence = 9])
                    else if (x = "Subtract") then return("-" meta [Precedence = 10])
                    else if (x = "Multiply") then return("*" meta [Precedence = 11])
                    else if (x = "Divide") then return("/" meta [Precedence = 12])
                    else if (x = "Concatenate") then return("&" meta [Precedence = 13])
                    else error Error.Record("Unhandled operator", "Unhandled operator type: " & x, null)
            in
                Diagnostics.LogValue2("Operator", op),

        // Get precedence of expresstion/operator
        precedence = (expressionOrOperator) =>
            let
                precedence = Value.Metadata(expressionOrOperator)[Precedence]?
            in
                valueOrDefault(precedence, 1000),

        // Compare precendence of 2 expressions/operators
        comparePrecedence = (x, y) =>
            if (precedence(x) < precedence(y)) then -1
            else if (precedence(x) > precedence(y)) then 1
            else 0,

        // Create format string for function invocation
        functionFormatExpr = (context, x) => 
            let 
                func = x[Function][Value],
                funcMetadata = Value.Metadata(Value.Type(func)),
                arguments = x[Arguments],
                argumentsCount = List.Count(arguments),
                caseInsensitive = context[CaseInsensitive]?,
                forceUseContains = context[ForceUseContains]?,
                dcountAccuracyLevel = let 
                        dcountAccuracyLevelValue = context[DcountAccuracyLevel]?,
                        validatedDcountAccuracyLevelValue = if (dcountAccuracyLevelValue = null) then dcountAccuracyLevelValue
                            else if (Value.Is(dcountAccuracyLevelValue, Number.Type) = false) then error Error.Record("Unsupported DcountAccuracyLevel", "Unsupported DcountAccuracyLevel: Value must be of type Nubmber")
                            else if (List.Contains({-1,0,1,2,3,4}, dcountAccuracyLevelValue) = false) then error Error.Record("Unsupported DcountAccuracyLevel", "Unsupported DcountAccuracyLevel: Value must be of between -1 and 4")
                            else dcountAccuracyLevelValue
                    in 
                        validatedDcountAccuracyLevelValue,

                caseInsensitiveComparison = (arguments as list, index as number) => let 
                        comparerArgument = argumentToConstant(arguments, index)
                    in
                        (comparerArgument = null and caseInsensitive = true) or (comparerArgument = Comparer.OrdinalIgnoreCase),
                stringOperator = (arguments, index, caseSensitiveResult, caseInsensitiveResult) => 
                    if (caseInsensitiveComparison(arguments, index)) 
                        then caseInsensitiveResult 
                        else caseSensitiveResult,

                formatStr = 
                    if funcMetadata[Kusto.Query]? <> null then return(funcMetadata[Kusto.Query][Query] & "(" & Text.Combine(List.Transform(arguments, each @Expressions(context, _)), ", ") & ")")
                    else if (func = Value.Equals) then return("#{0} == #{1}") // TODO: precision
                    else if (func = Value.NullableEquals) then return("#{0} == #{1}") // TODO: precision
                    else if (func = Value.NotEquals) then return("#{0} != #{1}") // TODO: precision
                    else if (func = Value.NotNullableEquals) then return("#{0} != #{1}") // TODO: precision
                    else if (func = Value.Add) then return("#{0} + #{1}") // TODO: precision
                    else if (func = Value.Subtract) then return("#{0} - #{1}") // TODO: precision
                    else if (func = Value.Multiply) then return("#{0} * #{1}") // TODO: precision
                    else if (func = Value.Divide) then return("#{0} / #{1}") // TODO: precision
                    else if (func = Text.From) then 
                        let 
                            input = handleExpr(context, arguments{0})
                        in
                            if (isOfType(input, "string")) then return("#{0}")
                            else return("tostring(#{0})") 
                    else if (func = Text.At) then return("substring(#{0}, #{1}, 1)") 
                    else if (func = Text.Combine) then
                        let 
                            parts = arguments{0},
                            separator =
                                if argumentsCount = 1 then
                                    ""
                                else if argumentsCount = 2 then
                                    arguments{1}
                                else
                                    ...
                        in
                            if context[QueryContext]? = "Aggregation" then //In group by
                                return ("strcat_array(make_list(#{0}), #{1})")
                            else if arguments{0}[Kind] = "FieldAccess" then //Refering to a list column
                                return ("strcat_array(#{0}, #{1})")
                            else
                                //Text.Combine({[a], [b], "c"}) is converted into [a] & [b] & "c"
                                //Text.Combine({[a], [b], "c"}) cannot be translated into a row expression
                                ...
                    else if (func = Text.Contains) then 
                        if (forceUseContains = true) then stringOperator(arguments, 2, return("#{0} contains_cs #{1}"), return("#{0} contains #{1}"))
                        else stringOperator(arguments, 2, return("#{0} has_cs #{1}"), return("#{0} has #{1}"))
                    else if (func = Text.NotContains) then 
                        if (forceUseContains = true) then stringOperator(arguments, 2, return("#{0} !contains_cs #{1}"), return("#{0} !contains #{1}"))
                        else stringOperator(arguments, 2, return("#{0} !has_cs #{1}"), return("#{0} !has #{1}"))
                    else if (func = Text.End) then return("substring(#{0}, (strlen(#{0})-#{1}), #{1})") 
                    else if (func = Text.EndsWith) then stringOperator(arguments, 2, return("#{0} endswith_cs #{1}"), return("#{0} endswith #{1}"))
                    else if (func = Text.NotEndsWith) then stringOperator(arguments, 2, return("#{0} !endswith_cs #{1}"), return("#{0} !endswith #{1}"))
                    else if (func = Text.Length) then return("strlen(#{0})") 
                    else if (func = Text.Lower) then return("tolower(#{0})") 
                    else if (func = Text.Middle) then (if (argumentsCount = 3) then return("substring(#{0}, #{1}, #{2})") else return("substring(#{0}, #{1})"))
                    else if (func = Text.PositionOf) then (
                        // If we got an Occurence argument other then "First" throw
                        if (argumentsCount >= 3 and (arguments{2}[Value]? <> Occurrence.First)) then 
                            error Error.Record("Unsupported function", "Unsupported function: Text.PositionOf with arguments other than Occurrence.First", arguments{2}[Value]?)
                        else 
                            stringOperator(arguments, 3, return("indexof(#{0}, #{1})"), return("indexof(toupper(#{0}), toupper(#{1}))"))                                        
                    )
                    else if (func = Text.Range) then (if (argumentsCount = 3) then return("substring(#{0}, #{1}, #{2})") else return("substring(#{0}, #{1})"))
                    else if (func = Text.Remove) then 
                        let
                            removeChars = arguments{1}[Value]
                        in
                            return("replace_regex(#{0}, '[" & Text.Combine(List.Transform(removeChars, (a) => escapeJsonChar(a))) & "]', '')")
                    else if (func = Text.RemoveRange) then (
                        if (argumentsCount = 3) then return("strcat(substring(#{0}, 0, #{1}), substring(#{0}, #{1}+#{2}))") 
                        else return("strcat(substring(#{0}, 0, #{1}), substring(#{0}, #{1}+1))"))
                    else if (func = Text.Replace) then return("replace_string(#{0}, @#{1}, #{2})")
                    else if (func = Text.ReplaceRange) then return("strcat(substring(#{0}, 0, #{1}), #{3}, substring(#{0}, #{1}+#{2}))") 
                    else if (func = Text.Start) then return("substring(#{0}, 0, #{1})") 
                    else if (func = Text.StartsWith) then stringOperator(arguments, 2, return("#{0} startswith_cs #{1}"), return("#{0} startswith #{1}"))                                        
                    else if (func = Text.NotStartsWith) then stringOperator(arguments, 2, return("#{0} !startswith_cs #{1}"), return("#{0} !startswith #{1}"))                                        
                    else if (func = Text.Upper) then return("toupper(#{0})") 
                    else if (func = Text.Insert) then return("strcat(substring(#{0}, 0, #{1}), #{2}, substring(#{0}, #{1}))") 
                    else if (func = Text.Split) then return("split(#{0}, #{1})") 
                    else if (func = Text.FromBinary) then return("tostring(#{0})") 
                    else if (func = Text.NewGuid) then return("new_guid()") 
                    else if (func = Text.Repeat) then return("strrep(#{0}, #{1})")
                    else if (func = Text.Trim) then (
                        if (argumentsCount = 1) then return("trim(@'[\s]+',#{0})") 
                        else 
                            let chars = if (arguments{1} is text) then ("[" & escapeJsonChar(arguments{1}) & "]") else ("[" & Text.Combine(arguments{1}[Value]) & "]")
                            in return("trim(@'" & chars & "', #{0})"))
                    else if (func = Text.TrimStart) then (
                        if (argumentsCount = 1) then return("trim_start(@'[\s]+',#{0})")
                        else 
                            let chars = if (arguments{1} is text) then ("[" & escapeJsonChar(arguments{1}) & "]") else ("[" & Text.Combine(arguments{1}[Value]) & "]")
                            in return("trim_start(@'" & chars & "', #{0})"))
                    else if (func = Text.TrimEnd) then (
                        if (argumentsCount = 1) then return("trim_end(@'[\s]+',#{0})") 
                        else 
                            let chars = if (arguments{1} is text) then ("[" & escapeJsonChar(arguments{1}) & "]") else ("[" & Text.Combine(arguments{1}[Value]) & "]")
                            in return("trim_end(@'" & chars & "', #{0})"))

                    else if (func = Byte.From) then return("toint(#{0})") 
                    else if (func = Currency.From) then return("todouble(#{0})") 
                    else if (func = Decimal.From) then return("todouble(#{0})") 
                    else if (func = Int8.From) then return("toint(#{0})") 
                    else if (func = Int16.From) then return("toint(#{0})") 
                    else if (func = Int32.From) then return("toint(#{0})") 
                    else if (func = Int64.From) then return("tolong(#{0})") 
                    else if (func = Single.From) then return("todouble(#{0})") 
                    else if (func = Double.From) then return("todouble(#{0})") 
                
                    else if (func = Number.FromText) then return("todouble(#{0})")
                    else if (func = Number.IsEven) then return("#{0} % 2 == 0") 
                    else if (func = Number.IsOdd) then return("#{0} % 2 == 1") 
                    else if (func = Number.From) then return("todouble(#{0})") 
                    else if (func = Number.Mod) then return("#{0} % #{1}") 
                    else if (func = Number.Random) then return("rand()")  // TODO: Number.Random() is evaluated before reaching here
                    else if (func = Number.RandomBetween) then return("(#{0} + rand((#{1}-#{0}))") 
                    else if (func = Number.Round) then return("round(#{0}, toint(#{1}))")
                    else if (func = Number.RoundDown) then return("floor(#{0}, 1)") 
                    else if (func = Number.RoundUp) then return("-floor(-#{0}, 1)")
                    else if (func = Number.RoundTowardZero) then return("iff(#{0}>0,1,-1)*floor(abs(#{0}), 1)")
                    else if (func = Number.RoundAwayFromZero) then return("iff(#{0}>0,-1,1)*floor(-abs(#{0}), 1)")
                    else if (func = Number.Abs) then return("abs(#{0})") 
                    else if (func = Number.Sign) then return("sign(#{0})") 
                    else if (func = Number.IntegerDivide) then return("bin((#{0}) / (#{1}), 1)") 
                    else if (func = Number.Sqrt) then return("sqrt(#{0})") 
                    else if (func = Number.Ln) then return("log(#{0})") 
                    else if (func = Number.Log10) then return("log10(#{0})") 
                    else if (func = Number.Log) then (if (argumentsCount = 1) then return("log(#{0})") else return("log(#{0}, #{1})"))
                    else if (func = Number.Exp) then return("exp(#{0})")
                    else if (func = Number.Power) then return("pow(#{0}, #{1})")
                    else if (func = Number.BitwiseAnd) then return("binary_and(#{0}, #{1})")
                    else if (func = Number.BitwiseOr) then return("binary_or(#{0}, #{1})")
                    else if (func = Number.BitwiseShiftLeft) then return("binary_shift_left(#{0}, #{1})")
                    else if (func = Number.BitwiseShiftRight) then return("binary_shift_right(#{0}, #{1})")
                    else if (func = Number.BitwiseNot) then return("binary_not(#{0})")
                    else if (func = Number.BitwiseXor) then return("binary_xor(#{0}, #{1})")

                    else if (func = Number.PI) then return("pi()")
                    else if (func = Number.Sin) then return("sin(#{0})")
                    else if (func = Number.Cos) then return("cos(#{0})")
                    else if (func = Number.Tan) then return("tan(#{0})")
                    else if (func = Number.Asin) then return("asin(#{0})")
                    else if (func = Number.Acos) then return("acos(#{0})")
                    else if (func = Number.Atan) then return("atan(#{0})")
                    else if (func = Number.Atan2) then return("atan2(#{0}, #{1})")
                    else if (func = Number.IsNaN) then return("isnan(#{0})")
                    else if (func = Number.PositiveInfinity) then return("real(+inf)")
                    else if (func = Number.NegativeInfinity) then return("real(-inf)")
                    else if (func = Number.Factorial) then return("tolong(gamma(#{0}+1))")

                    else if ((func = Binary.FromText) and arguments{1} = 0) then return("base64_decodestring(#{0})")
                    else if ((func = Binary.ToText) and arguments{1} = 0 and arguments{0} is text) then return("base64_encodestring(#{0})")

                    else if (func = List.Average) then WithAggregationContext(context, return("avg(#{0})"))
                    else if (func = List.Count and argumentsCount = 1 and arguments{0} is list) then return("arraylength(#{0})") 
                    else if (func = List.Count or func = Table.RowCount) then 
                        let
                            input = if (argumentsCount = 0 or arguments{0} = RowExpression.Row) then "" else handleExpr(context, arguments{0}),
                            inputContext = GetContext(input),
                            isDistinct = inputContext[Distinct]? = "true",
                            isFiltered = Record.HasFields(inputContext, {"Filtered"}) = true,
                            
                            countFunction = if (isDistinct) then
                                   if (dcountAccuracyLevel = -1) then "count_distinct" else "dcount"
                                else "count",

                            // decide between count(X), dcount(X), countif(predicate) and dcountif(X, predicate)
                            result = countFunction &
                                     (if (isFiltered) then
                                     if (isDistinct) then "if(" & inputContext[Filtered] & ", " else "if("
                                     else "(") &
                                     input &
                                     (if (isDistinct and dcountAccuracyLevel <> null and dcountAccuracyLevel <> -1) then (", " & Text.From(dcountAccuracyLevel)) else "") &
                                     ")"
                        in
                            SetContext(return(result), inputContext)
                    else if (func = List.Distinct) then 
                        let 
                            input = handleExpr(context, arguments{0}),
                            inputContext = GetContext(input),
                            distinctContext = inputContext & [ Distinct = "true" ],
                            result = WithAggregationContext(distinctContext, return(input)),
                            resultWithContext = SetContext(result, distinctContext)
                        in
                            resultWithContext
                    else if (func = List.Max) then WithAggregationContext(context, return("max(#{0})"))
                    else if (func = List.Min) then WithAggregationContext(context, return("min(#{0})"))
                    else if (func = List.StandardDeviation) then WithAggregationContext(context, return("stdev(#{0})"))
                    else if (func = List.Sum) then WithAggregationContext(context, return("sum(#{0})"))
                    else if (func = List.First and context[QueryContext]? = "Aggregation") then return("take_any(#{0})")
                    else if (func = List.First) then return("#{0}[0]")
                    else if (func = List.Last) then return("#{0}[arraylength(#{0}) - 1]")
                    else if (func = List.Range) then return("#{0}[#{1}]")
                    else if (func = List.Contains) then return("#{1} in " & handleExpr(context, arguments{0}))
                    else if (func = List.NotContains) then return("#{1} !in " & handleExpr(context, arguments{0}))
                    //else if (func = List.AnyTrue) then Text.Combine(List.Positions(arguments, (i) => "#{" & i & "}"), " or ")

                    // Not supported: List.Percentile([Column], {0.5, 0.75, 0.9}). The resulting column result is a dynamic list.
                    // We currently do not support tracking the data type in a dynamic value.
                    // Issue: Will result in failure if the aggregate column is a complex type like list instead of resulting in an error in each cell in the column
                    else if (func = List.Percentile and context[QueryContext]? = "Aggregation" and (arguments{2}? = null or arguments{2}? = [])) then
                        let
                            percentileArg = toConstant(arguments{1}),
                            isValid = percentileArg is number and 0 < percentileArg and percentileArg <= 1
                        in
                            if (isValid) then
                                return("percentile(#{0}, " & Number.ToText(percentileArg * 100) & ")")
                            else
                                ...

                    else if (func = List.Select) then let
                        input = handleExpr(context, arguments{0}),
                        inputContext = GetContext(input),
                        selectContext = inputContext & [ Filtered = input ],
                        filter = if (inputContext[Kind] = "Column") then handleExpr(selectContext, RowExpression.From(arguments{1}[Value]))
                                    else error "Lambda not supported in this context",
                        result = Text.Format(filter, {input}),
                        resultWithContext = SetContext(result, selectContext)
                    in
                        resultWithContext
                    else if (func = Table.RowCount) then WithAggregationContext(context, return("count()"))

                    else if (func = Record.ToTable) then return("#{0}") 

                    else if (func = DateTime.Date) then return("floor(todatetime(#{0}), 1d)") 
                    
                    else if (func = DateTime.LocalNow) then return("now()") 
                    else if (func = DateTime.FixedLocalNow) then return("now()") 
                    
                    else if (func = DateTimeZone.UtcNow) then return("now()") 
                    else if (func = DateTimeZone.FixedUtcNow) then return("now()") 
                    else if (func = DateTimeZone.LocalNow) then return("now()") 
                    else if (func = DateTimeZone.FixedLocalNow) then return("now()") 

                    // datetime/todatetime functions handle ALL parsing from string to datetime objects: https://kusto.azurewebsites.net/docs/query/scalar-data-types/datetime.html
                    else if (func = DateTime.FromText or 
                             func = DateTimeZone.FromText or
                             func = DateTime.From or 
                             func = DateTimeZone.From) then return("todatetime(#{0})")
                    
                    else if (func = Date.FromText) then return("floor(todatetime(#{0}),1d)")

                    else if (func = DateTime.Time) then return("#{0} - floor(#{0}, 1d)") 

                    else if (func = Date.AddDays) then return("(#{0} + #{1}d)") 
                    else if (func = Date.Day) then return("datepart('day', #{0})") 
                    else if (func = Date.Month) then return("getmonth(#{0})") 
                    else if (func = Date.Year) then return("getyear(#{0})") 
                    else if (func = Date.DayOfWeek) then
                        if (argumentsCount = 1) then return("(dayofweek(#{0})/1d)")
                        else return("((dayofweek(#{0})/1d) + " & Text.From(arguments{1}[Value]) & ")")
                     
                    else if (func = Date.DayOfYear) then return("dayofyear(#{0})") 
                    else if (func = Date.WeekOfYear) then return("week_of_year(#{0})")
                    else if (func = Date.WeekOfMonth) then return("(dayofmonth(#{0})/7)+1")

                    else if (func = Date.StartOfDay) then return("startofday(#{0})") 
                    else if (func = Date.StartOfWeek) then return("startofweek(#{0})") // TODO: Support optional firstDay argument
                    else if (func = Date.StartOfMonth) then return("startofmonth(#{0})") 
                    else if (func = Date.StartOfQuarter) then return ("(todatetime(strcat(getyear(#{0}),'-', 1+(3*floor((getmonth(#{0})-1) / 3, 1)),'-01 00:00:00')))")
                    else if (func = Date.StartOfYear) then return("startofyear(#{0})") 
                    else if (func = Date.EndOfDay) then return("endofday(#{0})") 
                    else if (func = Date.EndOfWeek) then return("endofweek(#{0})") 
                    else if (func = Date.EndOfMonth) then return("endofmonth(#{0})") 
                    else if (func = Date.EndOfYear) then return("endofyear(#{0})") 

                    else if (func = Date.IsInYearToDate) then return("(#{0} >= startofyear(now()) and #{0} <= now())") 

                    else if (func = Date.From) then return("floor(todatetime(#{0}),1d)") 
                    else if (List.Contains({Date.ToText, DateTime.ToText, DateTimeZone.ToText}, func)) then
                        //Incorrect but kept for legacy reasons: Date*.ToText([Date]) - Wrong format returned
                        //Folding breaks on:
                        //1. format is non-constant
                        //2. format uses AM/PM and culture does not resolve to constant "en-us" 
                        //3. format is not supported in ADX
                        //4. more than 30 tokens in format
                        //TODO:
                        //1. Support prefix/postfix of literals - No major perf impact
                        //Out of Scope:
                        //1. Support other format - Potential perf impact, requires inlining significant logic in query
                        //2. Support other cultures - Like #1, but requires a lot of work
                        let
                            date = argumentToNonConstant(0),
                            formatRaw = argumentToConstant(arguments, 1),
                            cultureRaw = argumentToConstant(arguments, 2)
                        in let
                            culture = Text.Lower(coalesce({cultureRaw, Culture.Current})), //Folding breaks if culture isn't constant, and is needed
                            simpleFormatMap = 
                            //Supported formats: https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/format-datetimefunction
                            #table(type table [ShortFormat = text, LongFormat = text], 
                            {
                                {"d", "MM/dd/yyyy"},
                                //{"D", "dddd, dd MMMM yyyy"} //dddd MMMM not supported
                                //{"f", "dddd, MMMM dd, yyyy h:mm tt"} //dddd MMMM not supported
                                //{"F", "dddd, MMMM dd, yyyy h:mm:ss tt"} //dddd MMMM not supported
                                {"g", "MM/dd/yyyy h:mm tt"},
                                {"G", "MM/dd/yyyy h:mm:ss tt"},
                                {"M", ... /*"MMMM dd"*/}, //MMMM not supported, format "M" is valid in ADX
                                //{"o", "yyyy-MM-dd'T'HH:mm:ss.fffffffK"} //'T' not supported
                                //{"r", "ddd, dd MMM yyyy HH':'mm':'ss 'GMT"} //ddd MMM 'GMT' not supported
                                {"s", ... /*"yyyy-MM-dd'T'HH:mm:ss"*/}, //'T' not supported, format "s" is valid in ADX
                                {"t", "h:mm tt"},
                                {"T", "h:mm:ss tt"}
                                //{"u", "yyyy-MM-dd HH:mm:ss'Z"} //'Z' not supported
                                //{"U", "dddd, MMMM dd, yyyy h:mm:ss tt"} //dddd MMMM not supported
                                //{"Y", "yyyy MMMM"} //MMMM not supported
                            }),
                            formatShortSubstitute = coalesce({simpleFormatMap{[ShortFormat = formatRaw]}?[LongFormat]?, formatRaw}),
                            format = 
                                //DateTimeZone.ToText maps "K" to +0:00 (or appropiate timezone), DateTime.ToText and Date.ToText map "K" to ""
                                if (func <> DateTimeZone.ToText) then
                                    Text.Remove(formatShortSubstitute, {"K"})
                                else
                                    formatShortSubstitute,
                            //Validation: check that the format string meets the limitations of ADX
                            delimiters = {" ", "/", "-", ":", ",", ".", "_", "[", "]"},
                            //ADX mostly only supports non-locale formats (exception: AM/PM)
                            formatSpecifiers = 
                            {
                                "d", "dd", 
                                "f", "Ff", "fff", "ffff", "fffff", "ffffff", "fffffff", 
                                "F", "FF", "FFF", "FFFF", "FFFFF", "FFFFFF", "FFFFFFF",
                                "h", "hh",
                                "H", "HH",
                                "m", "mm",
                                "M", "MM",
                                "s", "ss",
                                "y", "yy", "yyyy",
                                "tt"
                            },
                            chars = Text.ToList(format),
                            tokens = List.Accumulate(chars, {}, (current, next) =>
                                if next = Text.At(List.Last(current, "?"), 0) and not List.Contains(delimiters, next) then
                                    List.RemoveLastN(current, 1) & {List.Last(current) & next}
                                else
                                    current & {next})
                        in
                            //Incorrect for null, but kept for legacy reasons
                            if formatRaw = null or formatRaw = "" then //tostring(Date) == format_datetime("yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'")
                                return(Text.Format("tostring(#{0})", {date}))
                            else if Text.Length(formatRaw) = 1 and Text.Length(format) <= 1 then //invalid format specifier
                                ...
                            else if format = "" then //Format is "KKKKKKKKKK" for N Ks and type is date or datetime.
                                "''"
                            else if (
                                List.Count(tokens) <= 30 and //ADX only supports up to 30 tokens (undocumented?)
                                List.AllTrue(List.Transform(tokens, each List.Contains(formatSpecifiers & delimiters, _))) and
                                //AM/PM may be different for other cultures.
                                (not List.Contains(tokens, "tt") or culture = "en-us"))
                                then
                                    return(Text.Format("format_datetime(#{0}, '#{1}')", {date, format}))
                            else
                                ...

                    else if (func = Time.StartOfHour) then return("floor(#{0}, 1h)") 
                    else if (func = Time.EndOfHour) then return("(floor(#{0}, 1h) + 60m-1s)") 
                    else if (func = Time.Hour) then return("datepart(""hour"", #{0})") 
                    else if (func = Time.Minute) then return("datepart(""minute"", #{0})") 
                    else if (func = Time.Second) then return("datepart(""second"", #{0})") 
                    else if (func = Time.ToText) then return("tostring(#{0})") 

                    // TODO: Handle in a similar fashion to DateTime.From/DateTime.FromText
                    else if (func = Time.From) then return("time(#{0})") 
                    else if (func = Time.FromText) then return("time(#{0})") 
                    
                    else if (func = Json.Document) then return("parsejson(#{0})") 

                    else if (func = Duration.FromText) then return("totimespan(#{0})") 
                    else if (func = Duration.ToText) then return("tostring(#{0})") 

                    else if (func = Uri.Parts) then return("parseurl(#{0})") 

                    else if (func = Record.FieldOrDefault) then 
                        let
                            input = handleExpr(context, arguments{0}),
                            inputContext = GetContext(input)
                        in
                            return("#{0}[#{1}]")


                    // Explicit unsupported methods
                    else if (func = Character.FromNumber) then error Error.Record("Unsupported function", "Unsupported function: Character.FromNumber", null)
                    else if (func = Character.ToNumber) then error Error.Record("Unsupported function", "Unsupported function: Character.ToNumber", null)
                    
                    else if (func = Text.FromBinary) then error Error.Record("Unsupported function", "Unsupported function: Text.FromBinary", null)
                    else if (func = Text.ToBinary) then error Error.Record("Unsupported function", "Unsupported function: Text.ToBinary", null)
                    else if (func = Text.ToList) then error Error.Record("Unsupported function", "Unsupported function: Text.ToList", null)
                    else if (func = Text.PositionOfAny) then error Error.Record("Unsupported function", "Unsupported function: Text.PositionOfAny", null)
                    else if (func = Text.Clean) then error Error.Record("Unsupported function", "Unsupported function: Text.Clean", null)
                    else if (func = Text.PadEnd) then error Error.Record("Unsupported function", "Unsupported function: Text.PadEnd", null)
                    else if (func = Text.PadStart) then error Error.Record("Unsupported function", "Unsupported function: Text.PadStart", null)
                    else if (func = Text.Proper) then error Error.Record("Unsupported function", "Unsupported function: Text.Proper", null)
                    else if (func = Text.SplitAny) then error Error.Record("Unsupported function", "Unsupported function: Text.SplitAny", null)
                
                    
                    else if (func = Number.Combinations) then error Error.Record("Unsupported function", "Unsupported function: Number.Combinations", null)
                    else if (func = Number.Permutations) then error Error.Record("Unsupported function", "Unsupported function: Number.Permutations", null)
                
                    else if (func = DateTime.AddZone) then error Error.Record("Unsupported function", "Unsupported function: DateTime.AddZone", null)
                    else if (func = DateTime.FromFileTime) then error Error.Record("Unsupported function", "Unsupported function: DateTime.FromFileTime", null)
                    else if (func = DateTime.ToRecord) then error Error.Record("Unsupported function", "Unsupported function: DateTime.ToRecord ", null)

                    else if (func = Date.AddMonths) then error Error.Record("Unsupported function", "Unsupported function: Date.AddMonths", null)
                    else if (func = Date.AddQuarters) then error Error.Record("Unsupported function", "Unsupported function: Date.AddQuarters", null)
                    else if (func = Date.AddWeeks) then error Error.Record("Unsupported function", "Unsupported function: Date.AddWeeks", null)
                    else if (func = Date.AddYears) then error Error.Record("Unsupported function", "Unsupported function: Date.AddYears", null)
                    else if (func = Date.DaysInMonth) then error Error.Record("Unsupported function", "Unsupported function: Date.DaysInMonth", null)
                    else if (func = Date.EndOfQuarter) then error Error.Record("Unsupported function", "Unsupported function: EndOfQuarter", null)
                    else if (func = Date.IsInCurrentWeek) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInCurrentWeek", null)
                    else if (func = Date.IsInNextQuarter) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInNextQuarter", null)
                    else if (func = Date.IsInNextWeek) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInNextWeek", null)
                    else if (func = Date.IsInPreviousWeek) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInPreviousWeek", null)
                    else if (func = Date.IsInPreviousQuarter) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInPreviousQuarter", null)
                    else if (func = Date.IsInPreviousNDays) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInPreviousNDays", null)
                    else if (func = Date.IsInPreviousNWeeks) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInPreviousNWeeks", null)
                    else if (func = Date.IsInPreviousNMonths) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInPreviousNMonths", null)
                    else if (func = Date.IsInPreviousNQuarters) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInPreviousNQuarters", null)
                    else if (func = Date.IsInPreviousNYears) then error Error.Record("Unsupported function", "Unsupported function: Date.IsInPreviousNYears", null)

                    
                    else if (func = Time.FromText) then error Error.Record("Unsupported function", "Unsupported function: Time.FromText", null)
                    else if (func = Time.ToRecord) then error Error.Record("Unsupported function", "Unsupported function: Time.ToRecord", null)

                    else if (func = Value.As) then Error.Record("Unsupported function", "Unsupported function: Value.As", null)

                    else 
                        let
                            funcNameStr = valueOrDefault(Value.Metadata(Value.Type(func))[Documentation.Name]?, "Unknown: " & Value.ToText(x, 10))
                        in
                            error Error.Record("Unsupported function", "Unsupported function: " & funcNameStr, null)
            in
                Diagnostics.LogValue2("FunctionFormat", formatStr)
    in
        handleExpr(context, expression);

// Utility methods
startsWithWord = (text as text, substring as text) as logical =>
    let
        startsWith = Text.StartsWith(text, substring),
        exactMatch = text = substring,
        charAfterWord = Character.ToNumber(Text.At(text, Text.Length(substring))),
        isIdCharacter = (charAfterWord >= Character.ToNumber("a") and charAfterWord <= Character.ToNumber("z")) or
                        (charAfterWord >= Character.ToNumber("A") and charAfterWord <= Character.ToNumber("Z")) or
                        (charAfterWord >= Character.ToNumber("0") and charAfterWord <= Character.ToNumber("9")) or
                        charAfterWord = "_"
    in
        exactMatch or (startsWith and not isIdCharacter);

//Gets the text to prepend to a query when it is referred to by another query.
getPrefixContext = (state as record, context as record) as text =>
    let
        sameCluser = state[Cluster] = context[Cluster],
        sameDB = state[Database] = context[Database],
        query = state[Query],
        keywordsWithoutContext = {"datatable", "externaldata", "cluster", "print"}, // Queries we assume are not sensitive to current cluster/db
        keywordsWithClusterContext = {"database"}, // Queries that can be prepended with cluster('myCluster').
        keywordsWithFullContext = {"union", "let", "range", "evaluate", "find", "search"}, // Queries that can't have anything prepended to it
        unhandledKeywords = {"alias", "set", "pattern", "restrict"}, // Queries that aren't valid inside ()
        canExecuteWithoutAnyContext = List.AnyTrue(List.Transform(keywordsWithoutContext, each startsWithWord(query, _))),
        canExecuteWithOnlyClusterContext = List.AnyTrue(List.Transform(keywordsWithClusterContext, each startsWithWord(query, _))),
        canExecuteWithOnlyFullContext = List.AnyTrue(List.Transform(keywordsWithFullContext, each startsWithWord(query, _))),
        cannotExecute = List.AnyTrue(List.Transform(unhandledKeywords, each startsWithWord(query, _))) or Text.StartsWith(query, ".")
    in
        if cannotExecute then
            ... // e.g. set myoption=true; TableName | take 10
        else if canExecuteWithoutAnyContext then
            "" // e.g. datatable(a:int)[5]
        else if sameCluser then
            if sameDB then
                "" // e.g. union T, R
            else
                if canExecuteWithOnlyClusterContext then
                    "" // e.g. database('myDb').MyTable
                else if canExecuteWithOnlyFullContext then
                    ... // e.g. let result = myfunc(22); myfunc2(result, result)
                else
                    "database('" & state[Database] & "')." // e.g. TableName | take 10
        else
            if canExecuteWithOnlyClusterContext then
                "cluster('" & state[Cluster] & "')." // e.g. database('myDb').MyTable
            else if canExecuteWithOnlyFullContext then
                ... // e.g. let result = myfunc(22); myfunc2(result, result)
            else
                "cluster('" & state[Cluster] & "').database('" & state[Database] & "').";  // e.g. TableName | take 10

toHex = (i as number) as text =>
    let
        chars = "0123456789abcdef",
        low = Text.Range(chars, Number.Mod(i, 16), 1),
        high = Text.Range(chars, Number.RoundDown(i / 16), 1)
    in high & low;
escapeJsonChar = (text as text) as text =>
    if text = """" or text = "\" or text = "/" then "\" & text
    else if Character.ToNumber(text) < 32 then "\u00" & toHex(Character.ToNumber(text))
    else text;
escapeJsonString = (text as text) as text => Text.Combine(List.Transform(Text.ToList(text), escapeJsonChar));
escapeChar = (text as text) as text =>
    if text = """" then "\" & text
    else if text = "\" then "\\"
    else if Character.ToNumber(text) < 32 then "\u00" & toHex(Character.ToNumber(text))
    else text;
escapeString = (text as text) as text => Text.Combine(List.Transform(Text.ToList(text), escapeChar));
escapeValue = (context, value) =>
    if (value = null) then 
        if (Value.Metadata(value)[ValueType]? = "string") then """""" meta [ ValueType = "string", IsNull = true ]
        else if (Value.Metadata(value)[ValueType]? = "real") then "real(null)" meta [ ValueType = "real", IsNull = true ]
        else if (Value.Metadata(value)[ValueType]? = "int") then "long(null)" meta [ ValueType = "int", IsNull = true ]
        else if (Value.Metadata(value)[ValueType]? = "bool") then "bool(null)" meta [ ValueType = "bool", IsNull = true ]
        else if (Value.Metadata(value)[ValueType]? = "time") then "time(null)" meta [ ValueType = "time", IsNull = true ]
        else if (Value.Metadata(value)[ValueType]? = "datetime") then "datetime(null)" meta [ ValueType = "datetime", IsNull = true ]
        else if (Value.Metadata(value)[ValueType]? = "dynamic") then "null" meta [ ValueType = "dynamic", IsNull = true ]
        else "long(null)" meta [ ValueType = "int", IsNull = true ]
    else if (value = true) then "true" meta [ ValueType = "bool" ]
    else if (value = false) then "false" meta [ ValueType = "bool" ]
    else if (value = #infinity) then "real(+inf)" meta [ ValueType = "real" ]
    else if (value = -#infinity) then "real(-inf)" meta [ ValueType = "real" ]
    else if (value <> value) then "real(nan)" meta [ ValueType = "real" ]
    else if (value is text) then ("""" & escapeString(value) & """") meta [ ValueType = "string" ]
    else if (value is number) then Number.ToText(value,
        if Number.Round(value) = value then
                "f0"
        else
            null, "en-US") meta [ ValueType = "real" ]
    else if (value is logical) then Logical.ToText(value) meta [ ValueType = "bool" ]
    else if (value is time) then ("time(" & Time.ToText(value) & ")") meta [ ValueType = "time" ]
    else if (value is date) then ("datetime(" & DateTime.ToText(DateTime.From(DateTimeZone.ToUtc(DateTimeZone.From(value))), "yyyy-MM-dd HH:mm:ss.fffffff") & ")") meta [ ValueType = "datetime" ]
    else if (value is datetime) then ("datetime(" & DateTime.ToText(DateTime.From(DateTimeZone.ToUtc(DateTimeZone.From(value))), "yyyy-MM-dd HH:mm:ss.fffffff") & ")") meta [ ValueType = "datetime" ]
    else if (value is datetimezone) then ("datetime(" & DateTimeZone.ToText(DateTimeZone.ToUtc(value), "yyyy-MM-dd HH:mm:ss.fffffff") & ")") meta [ ValueType = "datetime" ]
    else if (value is duration) then ("time(" & Duration.ToText(value) & ")") meta [ ValueType = "time" ]
    else if (value is list and Value.Metadata(value)[ValueType]? = "dynamic") then "[" & Text.Combine(List.Transform(value, each @escapeValue(context, _ meta [ValueType="dynamic"])), ",") & "]"
    else if (value is list) then "(" & Text.Combine(List.Transform(value, (i) => if (i is record) then Expressions(context, i) else @escapeValue(context, (i))), ",") & ")"
    else if (value is function) then Record.FieldOrDefault(Value.Metadata(Value.Type(value)), "Documentation.Name", "<function>")
    else if (value is record) then "{" & Text.Combine(List.Transform(List.Zip({Record.FieldNames(value), Record.FieldValues(value)}), each @escapeValue(context, _{0}) & ":" & @escapeValue(context, _{1} meta [ValueType="dynamic"])), ", ") & "}"
    else if (value is table) then "(" & Value.NativeQuery(value, "", null, [Info = _Kusto.GetState]) & ")"
    else
        error Error.Record("DataSource.Error", "Unknown type for escaping", value);


toConstant = (expr as record) =>
    if expr[Kind] = "Constant" then
        expr[Value]
    else
        ...;

argumentToConstant = (arguments as list, index as number) =>
    if arguments{index}? = null then
        null
    else
        toConstant(arguments{index});

argumentToNonConstant = (index as number) =>
    "#{" & Number.ToText(index) & "}";

_Kusto.SmartQuery = (cluster as text, database as text, tableName as text, optional options as record) => 
    let
        // 9271076 - (workaround) add a null check on state[Query] to force eager evalution
        View = (state) => if (state[Query] <> null) then Table.View(null, Diagnostics.WrapHandlers([
            GetExpression = () =>
                [
                    Kind = "Invocation",
                    Function =
                    [
                        Kind = "Constant",
                        Value = Value.NativeQuery
                    ],
                    Arguments =
                    {
                        [
                            Kind = "Invocation",
                            Function =
                            [
                                Kind = "Constant",
                                Value = Kusto.Contents
                            ],
                            Arguments =
                            {
                                [
                                    Kind = "Constant",
                                    Value = cluster
                                ],
                                [
                                    Kind = "Constant",
                                    Value = database
                                ],
                                [
                                    Kind = "Constant",
                                    Value = tableName
                                ],
                                [
                                    Kind = "Constant",
                                    Value = options
                                ]
                            }
                        ],
                        [
                            Kind = "Constant",
                            Value = state[Query]
                        ]
                    }
                ],

            GetRows = () => let 
                    schemaTable = GetSchema(),
                    dateColumns = Table.ColumnsOfType(schemaTable, { type nullable date }),
                    dateTimeColumns = Table.ColumnsOfType(schemaTable, { type nullable datetime }),

                    queryResults = _Kusto.Query(state[Cluster], state[Database], state[Query], state[ClientActivityId], options),
                    // Convert Kusto's datetimezone values to PBI's date type
                    dateFixedResults = Table.TransformColumns(queryResults, List.Transform(dateColumns, (c) => { c, (x) => Date.From(DateTimeZone.RemoveZone(x)) })),
                    // Convert Kusto's datetimezone values to PBI's datetime type (by removing the zone which is always UTC in Kusto)
                    dateTimeFixedResults = Table.TransformColumns(dateFixedResults, List.Transform(dateTimeColumns, (c) => { c, (x) => DateTime.From(DateTimeZone.RemoveZone(x)) }))
                in 
                    dateTimeFixedResults,

            GetRowCount = () => let
                    rows = _Kusto.Query(state[Cluster], state[Database], NormalizeQuery(state[Query]) & "#(lf)| count", state[ClientActivityId], options)
                in
                    rows{0}[Count],

            GetSchema = () => GetSchemaFromState(state),

            GetSchemaFromState = (state) => let
                    schemaTable = if (state[Schema] = null)
                        then _Kusto.Schema(state[Cluster], state[Database], state[Query], state[ClientActivityId], options)
                        else state[Schema]
                in
                    schemaTable,

            GetType = () => let
                    schemaTable = GetSchema()
                in
                    Value.Type(schemaTable),
            
            OnSelectColumns = (columns) => 
                let
                    // Calculate updated schema
                    schema = GetSchema(),
                    newSchema = Table.SelectColumns(schema, columns),

                    existingColumnsCount = Table.ColumnCount(schema),
                    remainingColumnsCount = List.Count(Diagnostics.LogValue2("ColumnsToKeep", columns)),
                    projectAway = (remainingColumnsCount <> existingColumnsCount) and // Same number of columns => just reorder => use 'project'
                                  (remainingColumnsCount > (existingColumnsCount/ 2)), // More remaining columsn than existing => use 'project-away'
                    operator = if (projectAway = true) then "project-away" else "project",

                    // Retrieve list of column names
                    normalizedColumns = if (projectAway = true) then 
                            List.Transform(List.RemoveItems(Table.ColumnNames(schema), columns), (c) => NormalizeColumnName(c))
                        else 
                            List.Transform(columns, (c) => NormalizeColumnName(c)),

                    // Create new state
                    newState = state & [ 
                            Query = NormalizeQuery(state[Query]) & "#(lf)| " & operator & " " & Text.Combine(normalizedColumns, ","),
                            Schema = newSchema
                        ]
                in
                    @View(newState),

            OnSelectRows = (selector) => let
                    // Calculate updated schema
                    schema = GetSchema(),

                    schemaColumns = Table.TransformRows(Table.Schema(schema), (r) => [ Name = r[Name], TypeName = r[TypeName] ]),

                    // Calculate filtering
                    // start off expression translation from a row context
                    rowContext = [Columns = schemaColumns, CaseInsensitive = options[CaseInsensitive]?, ForceUseContains = options[ForceUseContains]?, DcountAccuracyLevel = options[DcountAccuracyLevel]?],
                    filter = Expressions(rowContext, RowExpression.From(selector)),

                    // Create new state
                    newState = state & [ 
                            Query = NormalizeQuery(state[Query]) & "#(lf)| where " & filter
                        ]
                in
                    @View(newState),

            OnSort = (order) => 
                let
                    // Calculate sorting expression
                    sorting = List.Transform(order, (o) => let
                            name = NormalizeColumnName(o[Name]),
                            order = o[Order],
                            orderText = if (order = Order.Ascending) then "asc" else "desc"
                        in
                            name & " " & orderText),
                    
                    // Create new state
                    newState = state & [ 
                            Query = NormalizeQuery(state[Query]) & "#(lf)| order by " & Text.Combine(sorting, ",")
                        ]
                in
                    @View(newState),

            OnTake = (count as number) => 
                let
                    existingQuery = NormalizeQuery(state[Query]),
                    suffix = "#(lf)| limit " & Text.From(count),
                    shouldAddLimit = not Text.EndsWith(existingQuery, suffix),
                    // Create new state
                    newState = state & [ 
                            Query = existingQuery & (if (shouldAddLimit) then suffix else "")
                        ]
                in
                    @View(newState),
                    
            OnAddColumns = (constructors) =>
                let
                    // Calculate updated schema
                    schema = GetSchema(),
                    newSchema = List.Accumulate(constructors, schema, (t, c) => Table.AddColumn(t, c[Name], each null, c[Type])),
                    schemaColumns = Table.TransformRows(Table.Schema(newSchema), (r) => [ Name = r[Name], TypeName = r[TypeName] ]),

                    // Calculate newly-created columns
                    ctors = List.Transform(constructors, (a) => let 
                            name = a[Name],
                            normalizedName = NormalizeColumnName(name),
                            func = a[Function],
                    
                            // start off expression translation from a row context
                            rowContext = [Columns = schemaColumns, CaseInsensitive = options[CaseInsensitive]?, ForceUseContains = options[ForceUseContains]?, DcountAccuracyLevel = options[DcountAccuracyLevel]?],
                            funcText = Expressions(rowContext, Diagnostics.LogValue2("OnAddColumns: " & name & "(" & Value.ToText(a[Type]) & ")", RowExpression.From(func)))
                        in 
                            normalizedName & "=" & funcText),

                    // Create new state
                    newState = state & [ 
                            Query = if (List.IsEmpty(ctors)) then
                                        state[Query]
                                    else
                                        NormalizeQuery(state[Query]) & "#(lf)| extend " & Text.Combine(ctors, ","),
                            Schema = newSchema
                        ]
                in
                    @View(newState),

            OnGroup = (keys, aggregates) => 
                let
                    // Calculate updated schema
                    schema = GetSchema(),

                    newSchema = Table.SelectColumns(schema, keys),
                    newSchema2 = List.Accumulate(aggregates, newSchema, (t, c) => Table.AddColumn(t, Diagnostics.LogValue2("AggregationColumn:", c)[Name], each null, c[Type])),
                    schemaColumns = Table.TransformRows(Table.Schema(newSchema2), (r) => [ Name = r[Name], TypeName = r[TypeName] ]),

                    //ADX does not have direct support case insensitive grouping. As such the following transformations are applied:
                    //1. For each column in the key join, a temp column is created with the value converted to string, and then made upper case
                    //   a. The reason that tostring is used is that there is no good way at this time to get the type of each column, and toupper will
                    //      result in an error if the column is not a string type.
                    //2. The key columns in the join are subsituted with their upper case varients.
                    //3. For each colum in the original key join, an additional aggregate with the name of the original key columns, selecting an arbitrary value to represent the join.
                    //4. Temp columns are removed
                    //5. The aggregate columns are reorded to be before the other columns.
                    isCaseInsensitiveGroup = options[CaseInsensitive]? = true,
                    tempColumnPrefix = Text.NewGuid(),

                    caseSensitiveTempKeys = 
                        if isCaseInsensitiveGroup then
                            List.Transform(keys, each NormalizeColumnName(tempColumnPrefix & "_" & _))
                        else
                            keys,
                    keys2 = List.Transform(keys, NormalizeColumnName),
                    keys2CaseInsensitive = 
                        if isCaseInsensitiveGroup then
                            List.Transform(List.Zip({caseSensitiveTempKeys, keys2}), each Text.Format("#{0} = toupper(tostring(#{1}))", _))
                        else
                            keys2,

                    // Calculate aggregated columns expression
                    aggrs = List.Transform(aggregates, (a) => let
                            name = a[Name],
                            normalizedName = NormalizeColumnName(name),
                            function = a[Function],
                            
                            // start off expression translation from a row context
                            rowContext = [Kind = "Row", QueryContext = "Aggregation", Columns = schemaColumns, CaseInsensitive = options[CaseInsensitive]?, ForceUseContains = options[ForceUseContains]?, DcountAccuracyLevel = options[DcountAccuracyLevel]?],
                            funcText = let
                                workaroundFunc = if (function = Table.RowCount) then (rows) => Table.RowCount(rows) else function
                            in
                                Expressions(rowContext, RowExpression.From(workaroundFunc))
                        in 
                            [
                                Text = (normalizedName & "=" & funcText)
                            ]),

                    aggs2 = aggrs & (
                        if isCaseInsensitiveGroup then
                            List.Transform(keys2, each [Text = Text.Format("#{0} = take_any(#{0})", {_})])
                        else
                            {}
                    ),

                    keysQueryPart = if (List.Count(keys) > 0) then (" by " & Text.Combine(if isCaseInsensitiveGroup then keys2CaseInsensitive else keys2, ", ")) else "",

                    keyedSchema = if List.Select(Table.Keys(newSchema2), each [Primary]){0}? = null then Table.AddKey(newSchema2, keys, true) else newSchema2,

                    summarized = Text.Combine({NormalizeQuery(state[Query]), "#(lf)| summarize ",  Text.Combine(List.Transform(aggs2, (a) => a[Text]), ", "), keysQueryPart}),

                    removedTempColumns = summarized & (if isCaseInsensitiveGroup then Text.Combine({"#(lf)| project-away ['", tempColumnPrefix, "*']"}) else ""),

                    moveKeyColumnsToFront = removedTempColumns & (if isCaseInsensitiveGroup then "#(lf)| project-reorder " & Text.Combine(keys2, ", ") else ""),

                    // Create new state
                    newState = state & [ 
                            Query = moveKeyColumnsToFront,
                            Schema = keyedSchema
                        ]
                in
                    @View(newState),

            OnDistinct = (columns) => 
                let
                    // Calculate updated schema
                    schema = GetSchema(),

                    // use original columns' order to preserve it after summarize operation which will force distinct columns to be on the left
                    projectionColumnOrder = Table.ColumnNames(schema),
                    projectionNormalizedColumns = List.Transform(projectionColumnOrder, NormalizeColumnName),
                    distinctColumnsNames = Table.ColumnNames(Table.SelectColumns(schema, columns)), 
                    // Currently, Kusto dynamic type is mapped to Any, which can be sampled using schema's 'Kind' column
                    dynamicTypeRows = Table.SelectRows(Table.Schema(schema), (row) => row[Kind] = "any"),
                    dynamicTypeColumnNames = Table.Column(dynamicTypeRows, "Name"),
                    isDistinctOnDynamic = List.ContainsAny(dynamicTypeColumnNames, distinctColumnsNames),
                    remainingColumnsNames = if isDistinctOnDynamic 
                        then error Error.Record("OnDistinct.Error", "Invalid column for distinct operation", List.Intersect({dynamicTypeColumnNames, distinctColumnsNames}))
                        else Table.ColumnNames(Table.RemoveColumns(schema, columns)),

                    // Calculate encoded columns expression
                    encodedColumns = List.Transform(columns, NormalizeColumnName),

                    // override any keys already applied upon given table
                    nonKeyedSchema = if Table.Keys(schema) <> null then Table.ReplaceKeys(schema, {}) else schema,
                    keyedSchema = Table.AddKey(nonKeyedSchema, columns, true),

                    newState = state &
                    [
                        Query = NormalizeQuery(state[Query]) & "#(lf)| summarize arg_max(1, *) by " & Text.Combine(encodedColumns, ", ") & " | project " & Text.Combine(projectionNormalizedColumns, ", "),
                        Schema = keyedSchema
                    ]
                in
                    @View(newState),

            OnNativeQuery = (query, parameters, options) =>
                if options[Info]? = _Kusto.GetState then
                    state[Query]
                else if options = null and parameters = null then
                    @View(state &
                        [
                            //Setting the schema to null forces it to be refreshed the next time it is referenced.
                            Schema = null,
                            Query = state[Query] & "#(cr,lf)" & query
                        ]
                    )
                else
                    ...,

            OnInvoke = (function, arguments, index) =>
                if (function = _Kusto.GetState) then state
                // TODO: Value.VersionIdentity?
                else if (function = Value.Versions) then
                    GetKustoTableVersions(
                        cluster,
                        database,
                        tableName,
                        () => Diagnostics.LogFailure(
                            "OnInvoke - Table Value.Versions dataCtor",
                            () => @_Kusto.SmartQuery(cluster, database, tableName, options)
                        ),
                        () => Diagnostics.LogFailure(
                            "OnInvoke - Table Value.Versions getType",
                            () => GetType()
                        )
                    )
                else if (function = DirectQueryCapabilities.From) then #table({"Name", "Value"},
                {
                    {"Core", null},
                    {"LiteralCount", 1000},
                
                    {"Table.FirstN", null},
                    {"Table.Sort", null},
                    {"Table.RowCount", null},

                    {"List.Average", null},
                    {"List.Sum", null},
                    {"List.Min", null},
                    {"List.Max", null},
                    {"List.StandardDeviation", null},
                    
                    {"Text.Start", null},
                    {"Text.End", null},
                    {"Text.Range", null},
                    {"Text.PositionOf", null},
                    {"Text.Replace", null},
                    {"Text.Lower", null},
                    {"Text.Upper", null},
                    {"Text.Length", null},
                    {"Text.TrimStart", null},
                    {"Text.TrimEnd", null},

                    {"Date.AddWeeks", null},
                    {"Date.Year", null},
                    {"Date.Month", null},
                    {"Date.WeekOfYear", null},
                    {"Date.Day", null},
                    {"Date.DayOfWeek", null},
                    {"Date.DayOfYear", null},

                    {"Duration.TotalDays", null},
                    {"Duration.TotalHours", null},
                    {"Duration.TotalMinutes", null},
                    {"Duration.TotalSeconds", null},

                    {"Number.Round", null},
                    {"Number.RoundUp", null},
                    {"Number.RoundDown", null},
                    {"Number.Mod", null},
                    {"Number.Abs", null},
                    {"Number.Sign", null},
                    {"Number.Power", null},
                    {"Number.Exp", null},
                    {"Number.Ln", null},
                    {"Number.Log10", null},
                    {"Number.Sqrt", null},
                    {"Number.Acos", null},
                    {"Number.Asin", null},
                    {"Number.Atan", null},
                    {"Number.Atan2", null},
                    {"Number.Cos", null},
                    {"Number.Sin", null},
                    {"Number.Tan", null}
                })
                else ...,

            OnRenameColumns = (renames) => let
                schema = GetSchema(),
                renamePairs = List.Transform(renames, each {[OldName], [NewName]}),
                newSchema = Table.RenameColumns(schema, renamePairs),
                renamesQuery = List.Transform(renames, each
                    let
                        oldName = [OldName],
                        newName = [NewName]?
                    in
                        if (newName = null) then NormalizeColumnName(oldName)
                        else NormalizeColumnName(newName) & " = " & NormalizeColumnName(oldName)),
                newState = state &
                [
                    Query = NormalizeQuery(state[Query]) & "#(lf)| project-rename " & Text.Combine(renamesQuery, ", "),
                    Schema = newSchema
                ]
            in
                @View(newState),

            OnJoin = (joinSide, leftTable, rightTable, joinKeys, joinKind) => let
                leftState = if (joinSide = 0) then state else _Kusto.GetState(leftTable), // TODO: Use JoinSide.Left when it's supported by Visual Studio
                rightState = if (joinSide = 1) then state else _Kusto.GetState(rightTable), // TODO: Use JoinSide.Right when it's supported by Visual Studio
                shouldInvertJoin = Diagnostics.LogValue2("shouldInvertJoin:", 
                    if (rightState[IsDimension] = true and 
                        leftState[IsDimension] <> true and 
                        (joinKind = JoinKind.LeftOuter or joinKind = JoinKind.Inner)) then true else false),
                finalJoinKind = if (shouldInvertJoin = true) then
                        if (joinKind = JoinKind.LeftOuter) then JoinKind.RightOuter
                        else if (joinKind = JoinKind.RightOuter) then JoinKind.LeftOuter
                        else joinKind
                    else joinKind,
                leftSchema = GetSchemaFromState(leftState),
                rightSchema = GetSchemaFromState(rightState),
                joinSchema = Table.FirstN(Table.Join(leftSchema, joinKeys[Left], rightSchema, joinKeys[Right], finalJoinKind), 0),
                joinQueryKind =
                    if (finalJoinKind = JoinKind.Inner) then "kind=inner"
                    else if (finalJoinKind = JoinKind.LeftOuter) then "kind=leftouter"
                    else if (finalJoinKind = JoinKind.RightOuter) then "kind=rightouter"
                    else if (finalJoinKind = JoinKind.FullOuter) then "kind=fullouter"
                    else if (finalJoinKind = JoinKind.LeftAnti) then "kind=leftanti"
                    else if (finalJoinKind = JoinKind.RightAnti) then "kind=rightanti"
                    else ...,
                joinQueryKeys = Text.Combine(Table.TransformRows(joinKeys, (r) => 
                    let 
                        left = "$left." & NormalizeColumnName(if (shouldInvertJoin = true) then r[Right] else r[Left]),
                        right = "$right." & NormalizeColumnName(if (shouldInvertJoin = true) then r[Left] else r[Right]),
                        // Kusto supports only == comparison in joins
                        comparer = if (r[EqualityComparer] = Value.Equals or r[EqualityComparer] = Value.NullableEquals) then " == "
                            else ...
                    in
                        left & comparer & right), ", "),
                // If the query contains header statements, we can do a join on the left, but not the right (without having to extract the header).
                leftPrefix = if joinSide = 1 then getPrefixContext(leftState, state) else "", 
                rightPrefix = getPrefixContext(rightState, state),
                // Add isnotnull() filtering in case of NullableEquals keyEqualityComparers 
                leftSuffix = Text.Combine(Table.TransformRows(joinKeys, (r) => if (r[EqualityComparer] = Value.NullableEquals) then "#(lf)| where isnotnull(" & NormalizeColumnName(r[Left]) &")" else "") , ""),
                rightSuffix = Text.Combine(Table.TransformRows(joinKeys, (r) => if (r[EqualityComparer] = Value.NullableEquals) then "#(lf)| where isnotnull(" & NormalizeColumnName(r[Right]) &")" else "") , ""),
                // Add extend and project-reorder to make sure the join result has the same schema as PBI expects
                extendSuffix =
                    let
                        convertToNull = (typeName) => if (typeName = "Text.Type") then "''" else (ConvertType(typeName) & "(null)"),
                        columns = Table.TransformRows(Table.Schema(leftSchema), (r) => [Name = r[Name], Type = r[TypeName]]),
                        extendColumnNames = "#(lf)| extend " & Diagnostics.LogValue2("extendSuffix",Text.Combine(List.Transform(columns, (r) => NormalizeColumnName(r[Name]) & "=" & convertToNull(r[Type])), ", "))
                    in
                        if (finalJoinKind = JoinKind.LeftAnti) then (extendColumnNames)
                        else if (finalJoinKind = JoinKind.RightAnti) then (extendColumnNames & "#(lf)| project-reorder " & Text.Combine(List.Transform(columns, (r) => NormalizeColumnName(r[Name])), ", "))
                        else "",
                // Build final join query of all parts
                joinQuery = 
                    if (shouldInvertJoin = true) then 
                        rightPrefix & NormalizeQuery(rightState[Query]) & rightSuffix & 
                        "#(lf)| join hint.strategy=broadcast " & joinQueryKind & " (" & 
                        leftPrefix & NormalizeQuery(leftState[Query]) & leftSuffix & 
                        ") on " & joinQueryKeys & extendSuffix
                    else
                        leftPrefix & NormalizeQuery(leftState[Query]) & leftSuffix &
                        "#(lf)| join " & joinQueryKind & " (" &
                        rightPrefix & NormalizeQuery(rightState[Query]) & rightSuffix &
                        ") on " & joinQueryKeys & extendSuffix,
                newState = state &
                [
                    Query = joinQuery,
                    Schema = joinSchema,
                    IsDimension = rightState[IsDimension] = true and leftState[IsDimension] = true
                ]
            in
                @View(newState),

            OnInsertRows = (rowsToInsert) => 
                let
                    hostname = Uri.Parts(cluster)[Host],
                    ingestMgmtEndpoint = GetIngestManagementEndpointUrl(hostname),
                    endpoints = FetchIngestionEndpoints(ingestMgmtEndpoint),
                    authContext = FetchAuthorizationContext(ingestMgmtEndpoint),
                    // The TempStorage (blob) URL will contain a SAS token. Split this out so we can use
                    // it to build the SAS credential.
                    splitUrl = SplitSasUrl(endpoints[TempStorage]),
                    // Convert data to the intermediate file format.
                    csvData = ConvertToStagingFormat(rowsToInsert, false),
                    // Calculate intermediate file info, including name, and fully qualified URL.
                    ingestionId = Diagnostics.ActivityId(),
                    fileName = Text.Format("#{0}_#{1}.csv.gz", {StagingPrefix, ingestionId}),
                    blobPath = DeriveBlobPath(splitUrl[Url], fileName),
                    blobPathWithSas = blobPath & "?" & splitUrl[Token],

                    // Get a pointer to the destination blob (which doesn't exist yet).
                    target = BlobWithSas.Contents(blobPath, splitUrl[Token]),

                    // Generate a JSON record containing ingestionStatusTable insertion details.
                    partitionKey = Text.NewGuid(),
                    rowKey = Text.NewGuid(),
                    ingestionsStatusTableEntity = CreateIngestionsStatusTableEntity(database,tableName,blobPath,partitionKey,rowKey,"","Pending","",""),

                    // Create Inline Mapping
                    inlineMapping = CreateInlineMapping(rowsToInsert, cluster,database,tableName),

                    // Generate a record containing the ingestion request details.
                    ingestionRequest = CreateIngestionRequest(
                        ingestionId,
                        database,
                        tableName,
                        blobPathWithSas,
                        authContext,
                        inlineMapping,
                        endpoints[IngestionsStatusTable],
                        partitionKey,
                        rowKey
                    ),
                    // Format the ingestion request into an XML message that we can post to the queue.
                    queueMessage = CreateQueueMessage(ingestionRequest),
                    urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, rowKey)
                in
                    try
                        Action.Sequence({
                            // Upload the data to blob storage.
                            // Replacing the non-existent blob content with the CSV binary content deploys
                            // the file. This logic is built into AzureStorage.BlobContents().
                            ValueAction.Replace(target, csvData),
                            // Insert Entity to IngestionsStatusTable Azure Tables.
                            AzureStorage.InsertEntity(urlDetails, ingestionsStatusTableEntity),
                            // Post the ingestion message to the Azure Queue.
                            AzureStorage.PostMessageToQueue(endpoints[SecuredReadyForAggregationQueue], queueMessage),
                            // Poll status from IngestionStatusTable.
                            GetOperationStatus(urlDetails),
                            Action.DoNothing
                        })
                    catch (e) => error Table.ViewError(e)
        ]))
        else error Table.ViewError(Error.Record("DataSource.Error", "Invalid view state", state))
    in
        View([ 
            Cluster = cluster,
            Database = database,
            Query = tableName,
            Schema = null,
            ClientActivityId = GetClientActivityId(),
            IsDimension = options[IsDimension]?
        ]);

TypeMap = #table(
    { "DataType", "Type" },
    {
        { "System.Double",                   type nullable Double.Type         },
        { "System.Int64",                    type nullable Int64.Type          },
        { "System.Int32",                    type nullable Int32.Type          },
        { "System.Int16",                    type nullable Int16.Type          },
        { "System.UInt64",                   type nullable Number.Type         },
        { "System.UInt32",                   type nullable Number.Type         },
        { "System.UInt16",                   type nullable Number.Type         },
        { "System.Byte",                     type nullable Byte.Type           },
        { "System.Single",                   type nullable Single.Type         },
        { "System.Decimal",                  type nullable Decimal.Type        },
        { "System.Data.SqlTypes.SqlDecimal", type nullable Decimal.Type },
        { "System.TimeSpan",                 type nullable Duration.Type       },
        { "System.DateTime",                 type nullable DateTimeZone.Type   },
        { "System.String",                   type nullable Text.Type           },
        { "System.Boolean",                  type nullable Logical.Type        },
        { "System.SByte",                    type nullable Logical.Type        },
        { "System.Object",                   type nullable Any.Type            },
        { "System.Guid",                     type nullable Text.Type           }
    });

GetQueryResultFromJson = (json) => 
    let
        tables = json[Tables],
        // Find the TOC table
        tocTable = List.Last(tables),
        // Find the last QueryResult entry
        resultsTableInfo = List.Last(List.Select(tocTable[Rows], each _{1} = "QueryResult")),
        // Find the index/ordinal of the last QueryResult in the original tables list
        resultsTableOrdinal = resultsTableInfo{0},
        // Retrieve the QueryResult table
        resultsTable = if (List.Count(tables) = 1) then tables{0} else tables{resultsTableOrdinal}
    in
        resultsTable;

_Kusto.GetState = Table.ViewFunction((view) => ...);

_Kusto.ContentsDocs = let 
        clusterType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("Kusto.Contents.Cluster.Name")
        ],
        databaseType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("Kusto.Contents.Database.Name")
        ],
        tableOrQueryType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("Kusto.Contents.TableOrQuery"),
            Documentation.SampleValues = { Extension.LoadString("Kusto.Contents.TableOrQuery.Sample2"), Extension.LoadString("Kusto.Contents.TableOrQuery.Sample1") },
            Formatting.IsMultiLine = true,
            Formatting.IsCode = true
        ],
        maxRowsType = type number meta [
            Documentation.FieldCaption = Extension.LoadString("Kusto.Contents.MaxRows"),
            Documentation.SampleValues = { Extension.LoadString("Kusto.Contents.MaxRows.Sample") }
        ],
        maxSizeType = type number meta [
            Documentation.FieldCaption = Extension.LoadString("Kusto.Contents.MaxSize"),
            Documentation.SampleValues = { Extension.LoadString("Kusto.Contents.MaxSize.Sample") }
        ],
        noTruncateType = type logical meta [
            Documentation.FieldCaption = Extension.LoadString("Kusto.Contents.NoTruncate"),
            Documentation.SampleValues = { Extension.LoadString("Kusto.Contents.NoTruncate.Sample") }
        ],
        additionalSetStatementsType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("Kusto.Contents.AdditionalSetStatements"),
            Documentation.SampleValues = { Extension.LoadString("Kusto.Contents.AdditionalSetStatements.Sample") }
        ],

        _Kusto.OptionsRecord = type [
            optional MaxRows=maxRowsType, 
            optional MaxSize=maxSizeType, 
            optional NoTruncate=noTruncateType,
            optional AdditionalSetStatements=additionalSetStatementsType
        ] meta [
            Documentation.FieldCaption = Extension.LoadString("Kusto.Contents.Options")
        ],
        t = type function (cluster as clusterType, optional database as databaseType, optional tableOrQuery as tableOrQueryType, optional options as _Kusto.OptionsRecord) as table
    in 
        t meta [
            Documentation.Description = Extension.LoadString("Kusto.Contents.Function.Description"),
            Documentation.DisplayName = Extension.LoadString("Kusto.Contents.Function.DisplayName"),
            Documentation.Caption = Extension.LoadString("Kusto.Contents.Function.Caption"),
            Documentation.Name = Extension.LoadString("Kusto.Contents.Function.Name"),
            Documentation.LongDescription = Extension.LoadString("Kusto.Contents.Function.LongDescription"),
            Documentation.Examples = {[
                Description = Extension.LoadString("Kusto.Contents.Examples.Description"),
                Code = Extension.LoadString("Kusto.Contents.Examples.Code"),
                Result = Extension.LoadString("Kusto.Contents.Examples.Result")
            ]}
        ];

_Kusto.Schema = (cluster as text, database as text, query as text, clientActivityId as text, optional options as record, optional customSchema as logical) as table =>
    let
        customSchema = customSchema ?? false,
        clusterUrl = NormalizeUrl(cluster),
        requestUrl = BuildQueryUrl(clusterUrl, [db=database,csl=".show version"]),
        clientTimeout = options[Timeout]?,
        queryOptions = [request_readonly = "true"] // Force the query to be readonly, regardless of the CSL submitted
            & (if clientTimeout <> null then [servertimeout = Duration.ToText(clientTimeout)] else [])
            & [wasTokenValid = RefreshTokenAsNeeded()],
        queryProperties = Diagnostics.LogValue2("QueryProperties", [Options=queryOptions]),
        getSchemaAppendText = if customSchema then "" else "#(lf)| getschema",
        queryCsl = NormalizeQuery(query) & getSchemaAppendText,
        
        clientRequestIdPrefix = options[ClientRequestId]?,
        finalClientRequestIdPrefix = if (clientRequestIdPrefix = null) then "" else clientRequestIdPrefix & ";",

        json = WebRequest(requestUrl,
        [
            Content=Json.FromValue([
                csl = queryCsl,
                db = database,
                properties = queryProperties
            ]),
            Timeout=if clientTimeout <> null then clientTimeout else #duration(0,0,4,0),
            ExcludedFromCacheKey = { "x-ms-client-request-id" },
            Headers=[
                #"Content-Type" = "application/json; charset=utf-8", 
                #"Accept" = "application/json", 
                #"x-ms-app" = "PowerBIConnector",
                #"x-ms-client-version" = connectorVersion,
                #"x-ms-client-request-id" = finalClientRequestIdPrefix & clientActivityId & ";" & Text.NewGuid()
            ]
        ]),

        resultsTable = GetQueryResultFromJson(json),

        // Use the metadata cache to store the output between evaluations
        DataTable = Json.Document(Extension.Cache()[Metadata][Serialized](
            Text.Combine({clusterUrl, database, queryCsl}),
            () => Json.FromValue(resultsTable))),

        Columns = Table.FromRecords(DataTable[Columns]),
        Rows = Table.FromRows(DataTable[Rows], Columns[ColumnName]),
        RowsWithType = Table.Sort(Table.Join(Rows, {"DataType"}, TypeMap , {"DataType"}), {"ColumnOrdinal"}),
        ColumnsNames = Table.Column(RowsWithType, "ColumnName"),
        ColumnsTypes = Table.Column(RowsWithType, "Type"),
        ColumnsData = List.Zip({ ColumnsNames, ColumnsTypes}),
        TableWithColumns = #table(ColumnsNames, {}),
        TableWithTypedColumns = Table.TransformColumnTypes(TableWithColumns, ColumnsData),
        schemaTable = if customSchema then Rows else TableWithTypedColumns
    in
        schemaTable;

_Kusto.Query = (cluster as text, database as text, query as text, clientActivityId as text, optional options as record) as table =>
    let
        options = Diagnostics.LogValue2("Options", options),
        maxRows = options[MaxRows]?,
        maxSize = options[MaxSize]?,
        noTruncate = options[NoTruncate]?,
        additionalSetStatements = options[AdditionalSetStatements]?,
        clientTimeout = options[Timeout]?,
        clientRequestProperties = if options <> null then Record.FieldOrDefault(options, "ClientRequestProperties", []) else [],
        normalizedAdditionalSetStatements = if (additionalSetStatements <> null) then 
            (if (Text.EndsWith(NormalizeQuery(additionalSetStatements), ";")) then additionalSetStatements else NormalizeQuery(additionalSetStatements) & ";") & "#(lf)" 
            else "",
        clusterUrl = NormalizeUrl(cluster),
        queryOptions = []
            & (if (maxRows <> null) then [truncationmaxrecords = maxRows] else [])
            & (if (maxSize <> null) then [truncationmaxsize = maxSize] else [])
            & (if (maxRows = null and maxSize = null and noTruncate = true) then [notruncation = true] else [])
            & (if clientTimeout <> null then [servertimeout = Duration.ToText(clientTimeout)] else [])
            & clientRequestProperties
            & [request_readonly = "true"] // Force the query to be readonly, regardless of the CSL submitted
            & [wasTokenValid = RefreshTokenAsNeeded()],
        queryProperties = Diagnostics.LogValue2("QueryProperties", [Options=queryOptions]),
        finalQuery = normalizedAdditionalSetStatements & query,

        clientRequestIdPrefix = options[ClientRequestId]?,
        finalClientRequestIdPrefix = if (clientRequestIdPrefix = null) then "" else clientRequestIdPrefix & ";",

        json = WebRequest(BuildQueryUrl(clusterUrl, [db=database,csl=".show version"]),
        [
            Content=Json.FromValue([
                csl=finalQuery,
                db=database,
                properties=queryProperties
            ]),
            // If we got a timeout from the user, trust that ADX will honor it. Otherwise, give the default 4 minutes timeout
            Timeout=if clientTimeout <> null then clientTimeout else #duration(0,0,4,0),
            Headers=[
                #"Content-Type" = "application/json; charset=utf-8", 
                #"Accept" = "application/json", 
                #"x-ms-app" = "PowerBIConnector",
                #"x-ms-client-version" = connectorVersion,
                #"x-ms-client-request-id" = finalClientRequestIdPrefix & clientActivityId & ";" & Text.NewGuid()
            ]
        ]),
        TypeMap = #table(
            { "DataType", "Type" },
            {
                { "Double",     type nullable Double.Type },
                { "Int64",      type nullable Int64.Type },
                { "Int32",      type nullable Int32.Type },
                { "Int16",      type nullable Int16.Type },
                { "UInt64",     type nullable Number.Type },
                { "UInt32",     type nullable Number.Type },
                { "UInt16",     type nullable Number.Type },
                { "Byte",       type nullable Byte.Type },
                { "Single",     type nullable Single.Type },
                { "Decimal",    type nullable Decimal.Type },
                { "SqlDecimal", type nullable Decimal.Type },
                { "TimeSpan",   type nullable Duration.Type },
                { "DateTime",   type nullable DateTimeZone.Type },
                { "String",     type nullable Text.Type },
                { "Boolean",    type nullable Logical.Type },
                { "SByte",      type nullable Logical.Type },
                { "Guid",       type nullable Text.Type }
            }),

        Exception = json[Exceptions]?{0}?,
        Result = if (Exception <> null) then 
                    let
                        exceptionLines = Text.Split(Exception, "#(cr,lf)"),
                        filteredLines = List.Select(exceptionLines, (l) => Text.StartsWith(l, "   ") = false),
                        reconstructedException = Text.Combine(filteredLines, "#(cr,lf)")
                    in 
                        error reconstructedException
                    else 
                    let 
                        DataTable = GetQueryResultFromJson(json),

                        Columns = Table.FromRecords(DataTable[Columns]),
                        ColumnsWithType = Table.Join(Columns, {"DataType"}, TypeMap , {"DataType"}),
                        TableRows = Table.FromRows(DataTable[Rows], Columns[ColumnName]),
                        LastColumn = Table.ColumnCount(ColumnsWithType) - 1,
                        InvariantCulture = "",
                        TypedTable = Table.TransformColumnTypes(TableRows, Table.ToList(ColumnsWithType, (c) => { c{0}, c{LastColumn} }), InvariantCulture)
                    in
                        TypedTable
    in
        Result;

ConvertType = (typeName) =>
    let
        typeMap = #table(type table [TypeName = text, KustoType = text], {
            {"Byte.Type",         "int"},
            {"Currency.Type",     "real"},
            {"Date.Type",         "datetime"},
            {"DateTime.Type",     "datetime"},
            {"DateTimeZone.Type", "datetime"},
            {"Decimal.Type",      "decimal"},
            {"Double.Type",       "real"},
            {"Duration.Type",     "time"},
            {"Int8.Type",         "int"},
            {"Int16.Type",        "int"},
            {"Int32.Type",        "int"},
            {"Int64.Type",        "long"},
            {"Logical.Type",      "bool"},
            {"Number.Type",       "real"},
            {"Percentage.Type",   "real"},
            {"Single.Type",       "real"},
            {"Text.Type",         "string"}
        })
    in
        typeMap{[TypeName=typeName]}?[KustoType]?;

/* WRITE SUPPORT */

StagingPrefix = "PowerQuery";

VersionTableType = type table [Version = nullable text, Published = logical, Data = any, Modified = nullable datetime];

CommonMgmtEndpointHeaders = [
    #"Content-Type" = "application/json; charset=utf-8",
    #"Accept" = "application/json",
    #"x-ms-app" = "PowerBIConnector",
    #"x-ms-client-version" = connectorVersion,
    #"x-ms-client-request-id" = Diagnostics.ActivityId() & ";" & Text.NewGuid()
];

GetTypeForSchemaCreation = (typeName as text, columnName as text,nativeTypeDetails as table) as text =>
   let 
       Type = ConvertType(typeName) ?? (
           error Error.Record(
               "Expression.Error",
                Text.Format("Unsupported data type '#{0}'", {typeName}),
                [ Column = columnName, DateType = typeName ]
           )),
       NativeType = nativeTypeDetails{[ColumnName = columnName]}?[ColumnType]? ?? "",
       KustoType = if (NativeType = "") then Type else NativeType
    in 
       KustoType; 
       


CreateTable = (cluster as text, database as text, tableName as text, newTable as table) as action =>
    let
        mgmtEndpoint = Uri.Combine(cluster, "/v1/rest/mgmt"),
        schema = Table.Schema(newTable),
        withKustoType = Table.AddColumn(schema, "KustoType", each GetTypeForSchemaCreation([TypeName], [Name],#table({"ColumName","ColumnOrdinal","DataType","ColumnType"},{})), type text),
        normalizeColumnNames = Table.TransformColumns(withKustoType, {{"Name", NormalizeColumnName}}),
        withNameAndType = Table.AddColumn(normalizeColumnNames, "NameAndType", each Text.Format("#{0}:#{1}", {[Name], [KustoType]}), type text),
        columnArgs = Text.Combine(withNameAndType[NameAndType], ", "),
        jsonBody = [
            csl = ".create table " & NormalizeColumnName(tableName) & " ( " & columnArgs & ")",
            db = database
        ]
    in
        // TODO: Do we need to check the result? If the request fails, we'll get back an error status from Kusto.
        WebAction.Request(
            WebMethod.Post,
            mgmtEndpoint,
            [
                Headers = CommonMgmtEndpointHeaders,
                Content = Json.FromValue(jsonBody)
            ]
        );

FetchAuthorizationContext = (mgmtEndpoint as text) as text =>
    let 
        json = WebRequest(mgmtEndpoint,
        [
            Content=Json.FromValue([
                csl = ".get kusto identity token"
            ]),
            ExcludedFromCacheKey = { "x-ms-client-request-id" },
            Headers = CommonMgmtEndpointHeaders
        ]),
        toTable = Table.FromRecords({json}),
        expand = Table.ExpandListColumn(toTable, "Tables"),
        getRows = Table.ExpandRecordColumn(expand, "Tables", {"TableName", "Columns", "Rows"}),
        authContext = getRows{0}[Rows]{0}{0}
    in
        authContext;

FetchIngestionEndpoints = (mgmtEndpoint as text) as record =>
    let
        json = WebRequest(mgmtEndpoint,
        [
            Content=Json.FromValue([
                csl = ".get ingestion resources"
            ]),
            ExcludedFromCacheKey = { "x-ms-client-request-id" },
            Headers = CommonMgmtEndpointHeaders
        ]),
        toTable = Table.FromRecords({json}),
        expandTables = Table.ExpandListColumn(toTable, "Tables"),
        takeRows = Table.ExpandRecordColumn(expandTables, "Tables", {"TableName", "Columns", "Rows"}),
        splitRowsToColumns = Table.FromList(takeRows{0}[Rows], each _, {"Name", "Value"}),
        // TODO: Results will contain multiple entries - does it matter which one we take? 
        removeDuplicates = Table.Distinct(splitRowsToColumns, {"Name"}),
        asRecord = Record.FromTable(removeDuplicates)
    in
        asRecord;

GetKustoTableVersions = (cluster as text, database as text, tableName as text, currentValueCtor as function, tableTypeCtor as function) =>
    let
        partitionKey = Text.Format("#{0}_#{1}_#{2}", {StagingPrefix, database, tableName}),
        currentVersionRow = {null, true, currentValueCtor(), null},
        restOfVersionTable = GetRestOfVersionTable(cluster, database, tableName, partitionKey,tableTypeCtor()),
        versionsTable = #table(VersionTableType, {currentVersionRow} & restOfVersionTable)
    in
    // TODO: consider using the VersionTable.View helper function
    Table.View(versionsTable,
        Diagnostics.WrapHandlers2("GetKustoTableVersions", [
            OnInsertRows = (rows) =>
                let
                    columnNames = Table.ColumnNames(rows),
                    insertRowCount = Table.RowCount(rows)
                in
                    if (columnNames <> {"Version"}) then
                        error Table.ViewError(
                            Error.Record(
                                "Expression.Error",
                                "Expected inserted rows to only contain a 'Version' column",
                                [ ColumnNames = columnNames ]
                            ))
                    else if (insertRowCount <> 1) then
                        error Table.ViewError(
                            Error.Record(
                                "Expression.Error",
                                "Multiple version Inserts at a time is not supported",
                                [ Count = insertRowCount ]
                            )
                        )
                    else
                        let
                            endpoints = GetManagementEndpoints(cluster),
                            authContext = FetchAuthorizationContext(endpoints),
                            // The TempStorage (blob) URL will contain a SAS token. Split this out so we can use it to build the SAS credential.
                            splitUrl = SplitSasUrl(endpoints[TempStorage]),
                            // Calculate intermediate file info, including size, name, and fully qualified URL.
                            blobFileID = Text.NewGuid(),
                            ingestionsStatusTableEntity = CreateIngestionsStatusTableEntity(database,tableName,"",partitionKey,rows[Version]{0},blobFileID,"Staging","",""),
                            urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, rows[Version]{0})
                        in
                            try
                                Action.Sequence({
                                    // Insert Entity to IngestionsStatusTable Azure Tables.
                                    AzureStorage.InsertEntity(urlDetails, ingestionsStatusTableEntity),
                                    () =>
                                        let
                                            Versions = @GetKustoTableVersions(cluster,database,tableName,currentValueCtor,tableTypeCtor),
                                            InsertedVersion = Table.SelectRows(Versions,each [Version] = rows[Version]{0})
                                        in
                                            Action.Return(InsertedVersion)
                                })
                            catch (e) => error Table.ViewError(e),

            OnUpdateRows = (updates, selector) =>
                if (List.Count(updates) <> 1) then
                    error Table.ViewError(
                        Error.Record(
                            "Expression.Error",
                            "Multiple version Updates are not supported",
                            [ Count = List.Count(updates) ]
                        )
                    )
                else if (IsPublishUpdateExpression(updates{0}) <> true) then
                    error Table.ViewError(
                        Error.Record(
                            "Expression.Error",
                            "Unexpected Update expression",
                            [ Expression = updates{0} ]
                        )
                    )
                else
                    let
                        endpoints = GetManagementEndpoints(cluster),
                        urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, null),
                        IngestionStatusTable = GetIngestionStatusTable(urlDetails),
                        splitUrl = SplitSasUrl(endpoints[TempStorage]),
                        hostname = Uri.Parts(cluster)[Host],
                        ingestMgmtEndpoint = GetIngestManagementEndpointUrl(hostname),
                        authContext = FetchAuthorizationContext(ingestMgmtEndpoint),
                        withActions = Table.AddColumn(Table.SelectRows(versionsTable, selector), "Actions", (r) => 
                            Action.Sequence({ 
                                CommitStagingData(IngestionStatusTable,endpoints,r[Version],splitUrl,authContext,partitionKey)
                            })
                        )
                    in
                        try
                            Action.Sequence(withActions[Actions] & {
                                // Return empty version table
                                () => Action.Return(#table(VersionTableType, {}))
                            })
                        catch (e) => error Table.ViewError(e),

            OnDeleteRows = (selector) =>
                let 
                    selectedRows = Table.SelectRows(versionsTable, selector),
                    endpoints = GetManagementEndpoints(cluster),
                    IngestionStatusTable = GetIngestionStatusTable(urlDetails),
                    deletedVersionData =  ReturnDeletedVersion(),
                    VersionToDelete =
                        if ( Table.RowCount(selectedRows) = 1 ) then
                            selectedRows{0}
                        else
                            error Error.Record(
                                "Expression.Error",
                                "Multiple version Deletes are not supported",
                                [Count = Table.RowCount(selectedRows)]
                            ),
                    urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, VersionToDelete[Version]),
                    DeleteTableActions =
                        let 
                            ingestionsStatusTableEntity = CreateIngestionsStatusTableEntity(database,tableName,"",partitionKey,VersionToDelete[Version],"","Discarded","","")
                        in 
                            Action.Sequence({
                                Diagnostics.LogValue2("GetKustoTableVersions.OnDeleteRows - deleting version: " & VersionToDelete[Version] , Action.DoNothing),
                                () => AzureStorage.InsertEntity(urlDetails, ingestionsStatusTableEntity),
                                () =>
                                    let
                                        deleteVersionsTable = #table(type table [Version = nullable text, Published = logical, Data = table, Modified = nullable datetime], {{VersionToDelete[Version],false, deletedVersionData, null}})
                                    in
                                        Action.Return(deleteVersionsTable)
                            })
                 in 
                    try ( DeleteTableActions ) catch (e) => error Table.ViewError(e)
        ]
    ));

GetRestOfVersionTable = (cluster as text, database as text, tableName as text, partitionKey as text, sourceType as type) =>
    let
        endpoints = GetManagementEndpoints(cluster),
        urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, null),
        IngestionStatusTable = GetIngestionStatusTable(urlDetails),
        withPublishedColumn = Table.AddColumn(IngestionStatusTable,"Published", each false),
        withData = Table.AddColumn(withPublishedColumn, "Data", each
            GetStagedTableData(endpoints,[blobFileIdentifier],[Version],sourceType,cluster,partitionKey,database,tableName)
        ),
        withModifiedColumn = Table.AddColumn(withData,"Modified", each null),
        versionTable =  Table.SelectColumns(withModifiedColumn,{"Version","Published","Data","Modified"}),
        convertToRows = Table.ToRows(versionTable)
    in
        convertToRows;

GetIngestManagementEndpointUrl = (hostname as text) => Uri.Combine("https://ingest-" & hostname, "/v1/rest/mgmt");

// TODO: It seems like endpoints do changes everyday so if insertion is happening during day change, it may result in sending
// different endpoints in between the running process.
GetManagementEndpoints = (cluster as text) =>
    let
        hostname = Uri.Parts(cluster)[Host],
        ingestMgmtEndpoint = GetIngestManagementEndpointUrl(hostname),
        endpoints = FetchIngestionEndpoints(ingestMgmtEndpoint)
    in
        endpoints;

GetIngestionStatusTable = (urlDetails as record) =>
    let
        json = WebRequest(urlDetails[urlWithoutKey], [
            Headers = [
                #"x-ms-client-request-id" = Diagnostics.ActivityId(),
                #"x-ms-version" = "2019-07-07"
            ],
            ManualCredentials = true,
            CredentialQuery = urlDetails[SAS]
        ]),
        ConvertToTable = Table.FromRecords({json}),
        ExpandValue = Table.ExpandListColumn(ConvertToTable, "value"),
        ExpandValue1 = Table.ExpandRecordColumn(ExpandValue, "value", {"PartitionKey","RowKey","IngestionSourceId","IngestionSourcePath","Status","Database","Table","InlineMapping","OriginalSchema"}),
        ChangedTypes = Table.TransformColumnTypes(ExpandValue1,{{"PartitionKey", type text},{"RowKey", type text},{"IngestionSourceId", type text},{"IngestionSourcePath", type text},{"Status", type text},{"Database", type text}, {"Table", type text},{"InlineMapping",type text},{"OriginalSchema", type text}}),
        selectVersionRows = Table.SelectRows(ChangedTypes, each [Status] = "Pending" or [Status] = "Staging" or [Status] = "Pending_Empty"),
        selectedColumns = Table.SelectColumns(selectVersionRows,{"RowKey", "IngestionSourceId", "IngestionSourcePath","InlineMapping","Database","Table","OriginalSchema","Status"}),
        renamedColumns = Table.RenameColumns(selectedColumns,{{"RowKey","Version"},{"IngestionSourceId","blobFileIdentifier"},{"IngestionSourcePath", "blobFilePath"}})
    in
        renamedColumns;

// This is staging table, in case of Kusto scenario, this table is made up by accessing data from Azure Blob Storage and Ingestion Status Table for schema details 
GetStagedTableData = (endpoints as record, blobFileIdentifier as text, versionNumber as text,sourceType as type, cluster as text, partitionKey as text, database as text, tableName as text) =>
    Table.View( null,
        Diagnostics.WrapHandlers2("GetStagedTableData", [
            GetRows = () => error Error.Record("DataSource.Error", "Cannot access staged data for version table", null),
            GetType = () => sourceType,
            OnInsertRows = (rowsToInsert) =>
                let
                  splitUrl = SplitSasUrl(endpoints[TempStorage]),
                  status = if (Diagnostics.LogValue2("rowsToInsert",Table.IsEmpty(rowsToInsert))) then "Pending_Empty" else "Pending",
                  stagingData = ConvertToStagingFormat(rowsToInsert, false),
                  fileName = Text.Format("#{0}_#{1}.csv.gz", {StagingPrefix, blobFileIdentifier}),
                  blobPath = DeriveBlobPath(splitUrl[Url], fileName),
                  target = BlobWithSas.Contents(blobPath, splitUrl[Token])
                 in
            // TODO: Do we return a value?
                  try
                    Action.Sequence({
                        ValueAction.Replace(target, stagingData),
            // Insert Entity to IngestionsStatusTable Azure Tables.
                        () =>
                            let
                              inlineMapping = CreateInlineMapping(rowsToInsert,cluster,database,tableName),
                              originalSchema = CreateSchemaMapping(rowsToInsert),
                              urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, versionNumber),
                              ingestionsStatusTableEntity = CreateIngestionsStatusTableEntity(
                                  database,
                                  tableName,
                                  blobPath,
                                  partitionKey,
                                  versionNumber,
                                  blobFileIdentifier,
                                  status,
                                  inlineMapping,
                                  originalSchema
                                 )
                             in
                              AzureStorage.InsertEntity(urlDetails, ingestionsStatusTableEntity),
                        Action.DoNothing
                        })
                        catch (e) => error Table.ViewError(e)
                  ])
            );

// TODO: Consider using the Csv.WritableTypedDocument helper
GetStagedData = (endpoints as record, blobPath as text, tableType as type) =>
    let
        splitUrl = SplitSasUrl(endpoints[TempStorage]),
        blobBinaryFile = BlobWithSas.Contents(blobPath, splitUrl[Token]),
        stagedtable = ConvertFromStagingFormat(blobBinaryFile),
        toRows = Table.ToRows(stagedtable),
        datatable = #table(tableType,toRows)
    in
        datatable;

CommitStagingData = (IngestionStatusTable as table, endpoints as record, version as text, splitUrl as record, authContext as text, partitionKey as text, optional inlineMapping as text) as action =>
    let
        IngestionStatusRecord = Table.SelectRows(IngestionStatusTable, each [Version] = version){0}
     in 
        if (IngestionStatusRecord[Status] <> "Pending_Empty")  then 
            let 
                _inlineMapping = inlineMapping ?? IngestionStatusRecord[InlineMapping],
                blobPathWithSas = IngestionStatusRecord[blobFilePath] & "?" & splitUrl[Token],
                ingestionRequest = CreateIngestionRequest(
                    IngestionStatusRecord[blobFileIdentifier],
                    IngestionStatusRecord[Database],
                    IngestionStatusRecord[Table],
                    blobPathWithSas,
                    authContext,
                    _inlineMapping,
                    endpoints[IngestionsStatusTable],
                    partitionKey,
                    version
                ),
        // Format the ingestion request into an XML message that we can post to the queue.
                queueMessage = CreateQueueMessage(ingestionRequest),
                urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, version) 
            in 
                Action.Sequence({
                    // Post the ingestion message to the Azure Queue.
                    AzureStorage.PostMessageToQueue(endpoints[SecuredReadyForAggregationQueue], queueMessage),
                    // Poll status from IngestionStatusTable.
                    GetOperationStatus(urlDetails),
                    Action.DoNothing
                })
        else
            Action.DoNothing;

GetKustoDatabaseVersions = (cluster as text, database as text, currentValueCtor as function) =>
    let
        partitionKey = Text.Format("#{0}_#{1}", {StagingPrefix, database}),
        currentVersionRow = {null, true, currentValueCtor(), null},
        restOfVersionTable = GetRestOfDatabaseVersions(cluster, database, partitionKey),
        versionsTable = #table(VersionTableType, {currentVersionRow} & restOfVersionTable)
    in
        Table.View(versionsTable,
            Diagnostics.WrapHandlers2("GetKustoDatabaseVersions", [
                OnInsertRows = (rows) =>
                    let
                        columnNames = Table.ColumnNames(rows),
                        insertRowCount = Table.RowCount(rows)
                    in
                        if (columnNames <> {"Version"}) then
                            error Table.ViewError(
                                Error.Record(
                                    "Expression.Error",
                                    "Expected inserted rows to only contain a 'Version' column",
                                    [ ColumnNames = columnNames ]
                                ))
                        else if (insertRowCount <> 1) then
                            error Table.ViewError(
                                Error.Record(
                                    "Expression.Error",
                                    "Multiple version Inserts at a time is not supported",
                                    [ Count = insertRowCount ]
                                )
                            )
                        else
                            try
                                Action.Sequence({
                                    () => CreateInitialVersion(cluster,database,partitionKey,rows[Version]{0}),
                                    // Return version table filtered to newly inserted version row
                                    () =>
                                        let
                                            updatedVersionTable = @GetKustoDatabaseVersions(cluster, database, currentValueCtor),
                                            newVersion = Table.SelectRows(updatedVersionTable, each [Version] = rows[Version]{0})
                                        in
                                            Action.Return(newVersion)
                                })
                            catch (e) => error Table.ViewError(e),

                OnUpdateRows = (updates, selector) =>
                    let
                        selectedRows = Table.SelectRows(versionsTable, selector),
                        endpoints = GetManagementEndpoints(cluster),
                        urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, null),
                        IngestionStatusTable = GetIngestionStatusTable(urlDetails),
                        splitUrl = SplitSasUrl(endpoints[TempStorage]),
                        hostname = Uri.Parts(cluster)[Host],
                        ingestMgmtEndpoint = GetIngestManagementEndpointUrl(hostname),
                        authContext = FetchAuthorizationContext(ingestMgmtEndpoint)
                    in
                        if (Table.RowCount(selectedRows) <> 1) then
                            error Table.ViewError(
                                Error.Record(
                                    "Expression.Error",
                                    "Multiple version Updates are not supported",
                                    [ Count = Table.RowCount(selectedRows) ]
                                )
                            )
                        else if (IsPublishUpdateExpression(updates{0}) <> true) then
                            error Table.ViewError(
                                Error.Record(
                                    "Expression.Error",
                                    "Unexpected Update expression",
                                    [ Expression = updates{0} ]
                                )
                            )
                        else if (IsMultipleTableUpdate(selectedRows{0}[Data]) = true) then 
                            error Table.ViewError(
                                Error.Record(
                                    "Expression.Error",
                                    "Only one table update/insert at a time is supported",
                                    [ListOfTables = List.Distinct(selectedRows{0}[Data][Name])]
                                )
                            )
                        else
                            let
                                withActionsForVersion = Table.AddColumn(selectedRows, "Actions", (r) => 
                                    let
                                        tablesInVersion = r[Data],
                                        withActionsForTable = Table.AddColumn(
                                            tablesInVersion,
                                            "Actions",
                                            each GetActionsForCreateTable(
                                                endpoints,
                                                cluster,
                                                database,
                                                partitionKey,
                                                [Name],
                                                r[Version],
                                                [Data],
                                                IngestionStatusTable,
                                                splitUrl,
                                                authContext)
                                            )
                                    in 
                                        Action.Sequence({
                                            Action.Sequence(withActionsForTable[Actions]),
                                            RemoveVersionEntry(endpoints, database, partitionKey, r[Version])
                                        })
                                )
                            in
                                try Action.Sequence(
                                    withActionsForVersion[Actions] & {
                                        // Return empty version table
                                        () => Action.Return(#table(VersionTableType, {}))
                                    })
                                catch (e) => error Table.ViewError(e),

                OnDeleteRows = (selector) =>
                    let 
                        selectedRows = Table.SelectRows(versionsTable, selector),
                        endpoints = GetManagementEndpoints(cluster),
                        urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, null),
                        IngestionStatusTable = GetIngestionStatusTable(urlDetails),
                        deletedVersionData =  ReturnDeletedVersion(),
                        VersionToDelete =
                            if ( Table.RowCount(selectedRows) = 1 ) then
                                selectedRows{0}
                            else
                                error Error.Record(
                                    "Expression.Error",
                                    "Multiple version Deletes are not supported"
                                ),
                        DeleteTableActions =
                            let
                                tablesInVersion = VersionToDelete[Data],
                                withActionsForTable = Table.AddColumn(tablesInVersion, "Actions", each GetActionsForDeleteTable(endpoints, database, partitionKey, [Name],VersionToDelete[Version],IngestionStatusTable))
                            in 
                                Action.Sequence({
                                    Action.Sequence(withActionsForTable[Actions]),
                                    RemoveVersionEntry(endpoints, database, partitionKey, VersionToDelete[Version]),
                                    () =>
                                        let
                                            deleteVersionsTable = #table(type table [Version = nullable text, Published = logical, Data = table, Modified = nullable datetime], {{VersionToDelete[Version],false, deletedVersionData, null}})
                                        in
                                            Action.Sequence({Action.Return(deleteVersionsTable)})
                                })
                    in
                        try ( DeleteTableActions ) catch (e) => error Table.ViewError(e)
            ])
        );

ReturnDeletedVersion = () as table => error Error.Record("Expression.Error", "Data is not available to access as it has been deleted");

CreateInitialVersion = (cluster as text, database as text, partitionKey as text, version as text) =>
    let
        endpoints = GetManagementEndpoints(cluster),
        splitUrl = SplitSasUrl(endpoints[TempStorage]),
        blobFileID = Text.NewGuid(),
        ingestionsStatusTableEntity = CreateIngestionsStatusTableEntity(database,"","",partitionKey,version,blobFileID,"Staging","",""),
        urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, version)
    in
        AzureStorage.InsertEntity(urlDetails, ingestionsStatusTableEntity);

RemoveVersionEntry = (endpoints as record, database as text, partitionKey as text, version as text) as action =>
    let
        ingestionsStatusTableEntity = CreateIngestionsStatusTableEntity(database,"","",partitionKey,version,"","Discarded","",""),
        urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, version)
    in
        Action.Sequence({
            AzureStorage.InsertEntity(urlDetails, ingestionsStatusTableEntity),
            Action.DoNothing
        });

GetActionsForCreateTable = (endpoints as record, cluster as text, database as text, partitionKey as text, tableName as text, version as text,tableToCreate as table,IngestionStatusTable as table , splitUrl as record , authContext as text ) =>
    let
        versionNumber = Text.Format("#{0}@#{1}", {version, tableName}),
        IngestionStatusRecords = Table.SelectRows(IngestionStatusTable, each [Version] = versionNumber),
        IngestionStatusRecord = 
            if(Table.RowCount(IngestionStatusRecords) = 1) then
                IngestionStatusRecords{0}
            else
                error Error.Record("Expression.Error", "IngestionStatus Table has multiple records for a table", [Name = tableName, Version = versionNumber]),
        inlineMapping = CreateInlineMapping(tableToCreate,cluster,database,tableName)
    in
        Action.Sequence({
            CreateTable(cluster,database,IngestionStatusRecord[Table],tableToCreate),
            CommitStagingData(IngestionStatusTable,endpoints,versionNumber,splitUrl,authContext,partitionKey,inlineMapping),
            Action.DoNothing
        });

GetActionsForDeleteTable = (endpoints as record, database as text, partitionKey as text, tableName as text, version as text,IngestionStatusTable as table) =>
    let
        versionNumber = Text.Format("#{0}@#{1}", {version, tableName}),
        ingestionsStatusTableEntity = CreateIngestionsStatusTableEntity(database,tableName,"",partitionKey,versionNumber,"","Discarded","",""),
        urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, versionNumber)
    in
        Action.Sequence({
            AzureStorage.InsertEntity(urlDetails, ingestionsStatusTableEntity),
            Action.DoNothing
        });

GetRestOfDatabaseVersions = (cluster as text, database as text, partitionKey as text) =>
    let
        sourceType = type table [Name = text, ItemKind = text, ItemName = text, Data = any, IsLeaf = logical ],
        endpoints = GetManagementEndpoints(cluster),
        urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, null),
        IngestionStatusTable = GetIngestionStatusTable(urlDetails),
        renamedColumn = Table.RenameColumns(IngestionStatusTable,{"Version","TempVersion"}),
        addVersion = Table.AddColumn(renamedColumn,"Version" , each Text.BeforeDelimiter([TempVersion], "@")),
        removeTempVersion = Table.RemoveColumns(addVersion,"TempVersion"),
        versions = List.Distinct(removeTempVersion[Version]),
        VersionTable = Table.FromList(versions,Splitter.SplitByNothing(),{"Version"}),
        withPublishedColumn = Table.AddColumn(VersionTable,"Published", each false),
        withData = Table.AddColumn(withPublishedColumn,"Data",each GetDatabaseVersionTableRow(endpoints, [Version], removeTempVersion, cluster, database, partitionKey, sourceType), type table),
        withModifiedColumn = Table.AddColumn(withData,"Modified", each null),
        versionTable = Table.SelectColumns(withModifiedColumn,{"Version","Published","Data","Modified"}),
        convertToRows = Table.ToRows(versionTable)
    in
        convertToRows;

GetDatabaseVersionTableRow = (endpoints as record, version as text, ingestionStatusTable as table, cluster as text, database as text, partitionKey as text, sourceType as type) =>
    let
        alltables = Table.SelectRows(ingestionStatusTable, each [Version] = version),
        withData = Table.AddColumn(alltables,"Content", each GetStagedTableDataforDB(endpoints,[blobFileIdentifier],[Version],cluster,partitionKey,database,[Table],[OriginalSchema])),
        stageddb =
            if ((Table.RowCount(withData) = 1) and withData[Table]{0} = "") then
                #table(sourceType,{})
            else
                let
                    removeInitialVersionRecord = Table.SelectRows(withData,each [Table] <> "")
                in
                    #table(sourceType, removeInitialVersionRecord[Content])
    in
        Table.View(stageddb,
        [
            OnInsertRows = (rows) =>
                if (List.ContainsAll(Table.ColumnNames(rows), {"Name","Data"})) then
                    let
                        withActions = Table.AddColumn(rows,"Actions",(r) => 
                            let
                                endpoints = GetManagementEndpoints(cluster),
                                splitUrl = SplitSasUrl(endpoints[TempStorage]),
                                originalSchema = CreateSchemaMapping(r[Data]), 
                                versionNumber = Text.Format("#{0}@#{1}", {version, r[Name]}),
                                blobFilePath = Text.NewGuid(),
                                ingestionsStatusTableEntity = CreateIngestionsStatusTableEntity(
                                    database,
                                    r[Name],
                                    "",
                                    partitionKey,
                                    versionNumber,
                                    blobFilePath,
                                    "Pending",
                                    "",
                                    originalSchema
                                ),
                                urlDetails = Uri.BuildUriDetails(endpoints[IngestionsStatusTable], partitionKey, versionNumber)
                            in
                                Action.Sequence({
                                    AzureStorage.InsertEntity(urlDetails, ingestionsStatusTableEntity),
                                    Action.DoNothing
                                })
                        ) 
                    in
                        // TODO: We should be returning something here
                        try Action.Sequence(withActions[Actions]) catch (e) => error Table.ViewError(e)
                else 
                    error Table.ViewError(
                        Error.Record(
                            "Expression.Error",
                            "Expected inserted row to have Name and Data columns.",
                            [ Columns = Text.Combine(Table.ColumnNames(rows)) ]
                        )
                    )
        ]);

GetStagedTableDataforDB = (endpoints as record, blobFileIdentifier as text, versionNumber as text, cluster as text , partitionKey as text , database as text , tableName as text, originalSchema as text) => 
    if (tableName = "") then
        {}
    else 
        let 
            newTableType = GetNewTableSchema(originalSchema),
            formattedVersion = Diagnostics.LogValue2("StagedTableFormattedVersion",Text.Format("#{0}@#{1}", {versionNumber,tableName})),
            datatable = GetStagedTableData(endpoints,blobFileIdentifier,formattedVersion,newTableType,cluster,partitionKey,database,tableName),
            row = {tableName, "Table", "Table", datatable, true}
        in 
            row;

GetNewTableSchema = (mapping as text) =>
    let
        json = Json.Document(mapping),
        mappingTable = Table.FromRecords(json),
        columnMapping = List.Transform(json,(row) => {row[column], GetColumnType(row[DataType], row[column])}),
        onlyColumnName = Table.SelectColumns(mappingTable,{"column"}),
        transposed = Table.Transpose(onlyColumnName),
        newTableWithoutType = Table.PromoteHeaders(transposed),
        newTableWithType = Table.TransformColumnTypes(newTableWithoutType,columnMapping)
    in 
        Value.Type(newTableWithType);

// TODO: normalize all of the column type mapping code
GetColumnType = (typeName as text, columnName as text) => 
    let
        conversion = try Record.Field(#shared, typeName)
    in
        if (conversion[HasError] ) then
            error Error.Record(
                "Expression.Error",
                Text.Format("Unsupported data type '#{0}'", {typeName}),
                [ Column = columnName, DateType = typeName ]
            )
        else
            conversion[Value];

CreateSchemaMapping = (sourceTable as table) as text =>
    let
        schema = Table.Schema(sourceTable),
        limitColumns = Table.SelectColumns(schema,{"Name","TypeName"}),
        withMappingRecord = Table.AddColumn(limitColumns, "MappingRecord", each
            [
                column = [Name],
                DataType = [TypeName]
            ], type record),
        onlyMappingRecord = Table.SelectColumns(withMappingRecord,{"MappingRecord"}),
        rows = Table.ToRows(onlyMappingRecord),
        mapping = List.Transform(rows,(row) => row{0})
    in
        Text.FromBinary(Json.FromValue(mapping));

// It will create URI for Get Request and Patch Request for IngestionStatusTable
// Below are the example URLs
// Patch Request : https://mashuptesting.table.core.windows.net/ingestionsstatus20231023(PartitionKey='PowerQuery_TestTable',RowKey='bacf95ce-95de-47f6-9e58-ab57b743efcd@TestTable')
//                ?tn=ingestionsstatus20231023&sv=2019-07-07&st=2023-10-23T17%3A32%3A52Z&se=2023-10-27T18%3A32%3A52Z&sp=raud&%24format=application%2Fjson&sig=signature
// Get Request :   https://mashuptesting.table.core.windows.net/ingestionsstatus20231023()?tn=ingestionsstatus20231023&sv=2019-07-07&st=2023-10-23T17%3A32%3A52Z&se=2023-10-27T18%3A32%3A52Z&sp=raud
//                 &%24format=application%2Fjson&%24filter=PartitionKey%20eq%20%27PowerQuery_TestTable%27&sig=Signature
Uri.BuildUriDetails =(url as text, partitionKey as text, rowKey as nullable text) as record => 
    let
        uriParts = Uri.Parts(url),
        keysStr = if (rowKey = null) then "()" else Text.Format("(PartitionKey='#{0}',RowKey='#{1}')", {partitionKey,rowKey}),
        filterText = if (rowKey = null) then Text.Combine({"PartitionKey eq '",partitionKey, "'"}) else null,
        modifiedPath = uriParts & [ Path = uriParts[Path] & keysStr ],
        modifiedQuery = modifiedPath & [ Query = Record.AddField(modifiedPath[Query], "$format", "application/json") ],
        addFilter = if (filterText <> null) then modifiedQuery & [ Query = Record.AddField(modifiedQuery[Query], "$filter", filterText) ] else modifiedQuery,
        sas = [sig = addFilter[Query][sig]],
        withoutSAS = addFilter & [Query = Record.RemoveFields(addFilter[Query],"sig")],
        uri = Uri.FromParts(withoutSAS)
    in
        [urlWithoutKey = uri, SAS = sas];

Uri.FromParts = (parts) =>
    let
        port = if (parts[Scheme] = "https" and parts[Port] = 443) or (parts[Scheme] = "http" and parts[Port] = 80) then ""
            else ":" & Text.From(parts[Port]),
        div1 = if Record.FieldCount(parts[Query]) > 0 then "?"
            else "",
        div2 = if Text.Length(parts[Fragment]) > 0 then "#"
            else "",
        uri = Text.Combine(
            {parts[Scheme], "://", parts[Host], port, parts[Path], div1, Uri.BuildQueryString(parts[Query]), div2, parts[Fragment]})
    in
        uri;

AzureStorage.PostMessageToQueue = (queueUrlWithSas as text, message as text) as action =>
    let
        uriParts = Uri.Parts(queueUrlWithSas),
        sas = [sig = uriParts[Query][sig]],
        urlWithoutSAS =  uriParts & [Query = Record.RemoveFields(uriParts[Query],"sig")],
        reconstructedUri = Uri.FromParts(urlWithoutSAS & [Path = urlWithoutSAS[Path] & "/messages"])
    in
        WebAction.Request(
            WebMethod.Post,
            reconstructedUri,
            [
                Headers = [
                    #"x-ms-client-request-id" = Diagnostics.ActivityId(),
                    #"x-ms-version" = "2019-07-07",
                    #"Content-type" = "application/xml"
                ],
                Content = Text.ToBinary(message),
                ManualCredentials = true,
                CredentialQuery = sas
            ]
        );

AzureStorage.InsertEntity = (urlDetails as record, body as record) as action =>
    WebAction.Request(
        WebMethod.Patch,
        urlDetails[urlWithoutKey],
        [
            Headers = [
                #"x-ms-client-request-id" = Diagnostics.ActivityId(),
                #"x-ms-version" = "2020-12-06",
                #"Content-type" = "application/json"
            ],
            Content = Json.FromValue(body),
            ManualCredentials = true,
            CredentialQuery = urlDetails[SAS]
        ]
    );

GetOperationStatus = (urlDetails as record)  =>
    let
        waitForResult = Value.WaitFor(
            (iteration) =>
            let
                result = Web.Contents(
                    urlDetails[urlWithoutKey],
                    [
                        Headers = [
                            #"x-ms-client-request-id" = Diagnostics.ActivityId(),
                            #"x-ms-version" = "2019-07-07"
                        ],
                        ManualCredentials = true,
                        ManualStatusHandling = { 400, 403, 404, 500, 503 }, IsRetry = iteration > 0,
                        CredentialQuery = urlDetails[SAS]
                    ]),
                jsonResponse = Json.Document(result) meta Value.Metadata(result),
                responseStatusCode = Record.FieldOrDefault(Value.Metadata(jsonResponse), "Response.Status", 0),
                actualResult = if List.Contains({200,204},responseStatusCode) then Operation.CheckStatus(jsonResponse) else Web.ErrorResponse(responseStatusCode,jsonResponse)
            in
                actualResult,
            (iteration) => #duration(0, 0, 0, Number.Power(2, iteration)),
            7)
    in 
        waitForResult;

Operation.CheckStatus = (response as record) =>
    let
        status = if(response[Status] = "Pending") then null 
        else if(response[Status] = "Succeeded") then Action.DoNothing
        else error Error.Record("DataSource.Error",response[Details]?,[
                ActivityId  = response[ActivityId]?,
                OperationId = response[OperationId]?,
                ErrorCode = response[ErrorCode]?,
                Details = response[Details]?,
                Database = response[Database]?,
                Table = response[Table]?,
                TimeStamp = response[Timestamp]?,
                FailureStatus = response[FailureStatus]?
        ])
    in 
        status;

IsPublishUpdateExpression = (expr) =>
    try (expr[Name] = "Published" and RowExpression.From(expr[Function]) = [Kind = "Constant", Value = true]) otherwise false;

IsMultipleTableUpdate = (tablesInVersion as table) =>  
    List.Count(List.Distinct(tablesInVersion[Name])) <> 1;
                 
Web.ErrorResponse = (responseCode as number, jsonResponse as record) => 
    let 
        detail = [
            errormessage = jsonResponse[odata.error][message][value],
            errorcode = jsonResponse[odata.error][code]
        ]
    in
        error Error.Record("DataSource.Error", jsonResponse[odata.error][message][value], detail);

// https://docs.microsoft.com/en-us/azure/data-explorer/ingestion-properties#ingestion-properties
CreateIngestionRequest = (requestId as text, databaseName as text, tableName as text, blobPath as text, authorizationContext as text, mapping as text, ingestionsStatusTableUri as text,partitionkey as text,rowkey as text, optional additionalProperties as record) as record =>
[
    Id = requestId,
    BlobPath = blobPath,
    RawDataSize = 0,
    DatabaseName = databaseName,
    TableName = tableName,
    RetainBlobOnSuccess = true,
    FlushImmediately = true,
    ReportLevel = 2,    // Success/Error reporting level: 0-Failures, 1-None, 2-All
    ReportMethod = 1,   // Reporting mechanism: 0-Queue, 1-Table
    AdditionalProperties = [
        authorizationContext = authorizationContext,
        ingestionMapping = mapping,
        format = "csv"
    ] & (additionalProperties ?? []),
    IngestionStatusInTable = [
        TableConnectionString = ingestionsStatusTableUri,
        PartitionKey = partitionkey,
        RowKey = rowkey
    ]
];

CreateIngestionsStatusTableEntity = (databaseName as text,tableName as text,blobPath as text,partitionKey as text,rowKey as text,blobFileKey as text,status as text,inlinemapping as text , originalSchema as text) as record =>
[
    PartitionKey = partitionKey,
    RowKey = rowKey,
    Database = databaseName,
    IngestionSourceId = blobFileKey,
    IngestionSourcePath = blobPath,
    Status = status,
    Table = tableName,
    UpdatedOn = DateTimeZone.RemoveZone(DateTimeZone.UtcNow()),
    InlineMapping = inlinemapping,
    OriginalSchema = originalSchema
];

CreateInlineMapping = (sourceTable as table, cluster as text, database as text, tableName as text) as text =>
    let
        nativeSchemaDetails = GetNativeSchema(cluster,database,tableName,[]),
        schema = Table.Schema(sourceTable),
        limitColumns = Table.SelectColumns(schema,{"Name","Position","TypeName","Kind"}),
        // TODO: Validate that the data types match between incoming rows and destination table.
        // For now we are only setting the column name and ordinal in the mapping.
        withMappingRecord = Table.AddColumn(limitColumns, "MappingRecord", each [
                column = [Name],
                Properties = [
                    Ordinal = [Position]
                ],
                DataType = GetTypeForSchemaCreation([TypeName], [Name],nativeSchemaDetails)
            ], type record),
        onlyMappingRecord = Table.SelectColumns(withMappingRecord,{"MappingRecord"}),
        rows = Table.ToRows(onlyMappingRecord),
        mapping = List.Transform(rows,(row) => row{0})
    in 
        Text.FromBinary(Json.FromValue(mapping));

GetNativeSchema = (cluster as text, database as text, tableName as text, options as record) as table =>
    let
        clusterUrl = NormalizeUrl(cluster),
        requestUrl = BuildQueryUrl(clusterUrl, [db=database,csl=".show version"]),
        clientTimeout = options[Timeout]?,
        queryOptions = [request_readonly = "true"] // Force the query to be readonly, regardless of the CSL submitted
            & (if clientTimeout <> null then [servertimeout = Duration.ToText(clientTimeout)] else [])
            & [wasTokenValid = RefreshTokenAsNeeded()],
        queryProperties =  [Options=queryOptions],
        getSchemaAppendText =  "#(lf)| getschema",
        queryCsl = NormalizeQuery(tableName) & getSchemaAppendText,       
        clientRequestIdPrefix = options[ClientRequestId]?,
        finalClientRequestIdPrefix = if (clientRequestIdPrefix = null) then "" else clientRequestIdPrefix & ";",
        optionsForWeb = [
            Content=Json.FromValue([
                csl = queryCsl,
                db = database,
                properties = queryProperties
            ]),
            Timeout=if clientTimeout <> null then clientTimeout else #duration(0,0,4,0),
            ExcludedFromCacheKey = { "x-ms-client-request-id" },
            Headers=[
                #"Content-Type" = "application/json; charset=utf-8", 
                #"Accept" = "application/json", 
                #"x-ms-app" = "PowerBIConnector",
                #"x-ms-client-version" = connectorVersion,
                #"x-ms-client-request-id" = finalClientRequestIdPrefix & Text.NewGuid() & ";" & Text.NewGuid()
            ]
        ],
        emptyTable = #table({"ColumName","ColumnOrdinal","DataType","ColumnType"},{}),
        content = Web.Contents(requestUrl, optionsForWeb & [ManualStatusHandling = {400}]),
        json = try Json.Document(content) otherwise null,
        httpStatus = Value.Metadata(content)[Response.Status],
        Rows = if (httpStatus = 400) then emptyTable
               else if (json = null) then emptyTable
               else ProcessSchemaJson(json)
    in
        Rows;

ProcessSchemaJson = (json as record) as table =>
    let 
        DataTable = GetQueryResultFromJson(json),
        Columns = Table.FromRecords(DataTable[Columns]),
        Rows = Table.FromRows(DataTable[Rows], Columns[ColumnName])
     in 
        Rows;

CreateQueueMessage = (ingestionRequest as record) as text =>
    let
        base64Encoded = Binary.ToText(Json.FromValue(ingestionRequest), BinaryEncoding.Base64)
    in
        "<?xml version=""1.0"" encoding=""utf-8""?><QueueMessage><MessageText>" & base64Encoded & "</MessageText></QueueMessage>";

DeriveBlobPath = (blobUrl as text, fileName as text) as text => Uri.Combine(blobUrl & "/", fileName);

FixDateTimeZoneColumn = (value as table) as table =>
    let
        schema = Table.Schema(value),
        timezoneColumns = Table.SelectColumns(Table.SelectRows(schema,each [Kind] = "datetimezone"),{"Name"})[Name],
        datetimeZoneFixedValue = Table.TransformColumns(value, List.Transform(timezoneColumns, (c) => { c, (x) => DateTimeZone.RemoveZone(DateTimeZone.ToUtc(x)) }))   
     in 
        datetimeZoneFixedValue;

SplitSasUrl = (url as text) as record =>
    let
        uriParts = Uri.Parts(url),
        uriWithoutSas = Uri.FromParts(uriParts & [Query = []])
    in
        [ Url = uriWithoutSas, Token = Uri.BuildQueryString(uriParts[Query])];

ConvertToStagingFormat = (value as table, optional includeHeaders as logical) as binary =>
    Binary.Compress(Csv.FromValue(FixDateTimeZoneColumn(value), includeHeaders), Compression.GZip);

ConvertFromStagingFormat = (value as binary) as table =>
    Csv.Document(Binary.Decompress(value, Compression.GZip));

GetAuthorizationUrlFromWwwAuthenticate = (cluster) =>
    let
        clusterUrl = NormalizeUrl(cluster),
        response = Web.Contents(
            BuildQueryUrl(clusterUrl),
            [
                ManualStatusHandling = {401, 400, 302},
                Content=Json.FromValue([
                    csl =".show version",
                    db = "NetDefaultDB"
                ]),
                    Timeout=#duration(0, 0, 4, 0),
                    Headers=[
                        #"Content-Type" = "application/json; charset=utf-8", 
                        #"Accept" = "application/json", 
                        #"x-ms-app" = "PowerBIConnector"
                    ]
            ]),
        headers = Record.FieldOrDefault(Value.Metadata(response), "Headers", []),
        wwwAuthenticate = Record.FieldOrDefault(headers, "WWW-Authenticate", ""),
        errorResponse = if (wwwAuthenticate = "") then error Error.Record("DataSource.Error", Extension.LoadString("Errors.WwwAuthenticateNotFound")) else null,
        authorizationUri = Text.BetweenDelimiters(wwwAuthenticate, "authorization_uri=""", """") & "/oauth2/authorize"
    in
        valueOrDefault(errorResponse, authorizationUri);

_AzureDataExplorer.ContentsDocs =
    let
        clusterType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.Cluster.Name"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.Cluster.Sample") }
        ],
        databaseType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.Database.Name"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.Database.Sample") }
        ],
        tableOrQueryType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.TableOrQuery"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.TableOrQuery.Sample2"), Extension.LoadString("AzureDataExplorer.Contents.TableOrQuery.Sample1") },
            Formatting.IsMultiLine = true,
            Formatting.IsCode = true
        ],
        maxRowsType = type number meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.MaxRows"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.MaxRows.Sample") }
        ],
        maxSizeType = type number meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.MaxSize"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.MaxSize.Sample") }
        ],
        noTruncateType = type logical meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.NoTruncate"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.NoTruncate.Sample") }
        ],
        additionalSetStatementsType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.AdditionalSetStatements"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.AdditionalSetStatements.Sample") }
        ],

        _Kusto.OptionsRecord = type [
            optional MaxRows=maxRowsType, 
            optional MaxSize=maxSizeType, 
            optional NoTruncate=noTruncateType,
            optional AdditionalSetStatements=additionalSetStatementsType
        ] meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.Options")
        ],
        t = type function (cluster as clusterType, optional database as databaseType, optional tableOrQuery as tableOrQueryType, optional options as _Kusto.OptionsRecord) as table
    in 
        t meta [
            Documentation.Description = Extension.LoadString("AzureDataExplorer.Contents.Function.Description"),
            Documentation.DisplayName = Extension.LoadString("AzureDataExplorer.Contents.Function.DisplayName"),
            Documentation.Caption = Extension.LoadString("AzureDataExplorer.Contents.Function.Caption"),
            Documentation.Name = Extension.LoadString("AzureDataExplorer.Contents.Function.Name"),
            Documentation.LongDescription = Extension.LoadString("AzureDataExplorer.Contents.Function.LongDescription"),
            Documentation.Examples = {[
                Description = Extension.LoadString("AzureDataExplorer.Contents.Examples.Description"),
                Code = Extension.LoadString("AzureDataExplorer.Contents.Examples.Code"),
                Result = Extension.LoadString("AzureDataExplorer.Contents.Examples.Result")
            ]}
        ];

[DataSource.Kind = "Kusto"]
shared Kusto.Contents = Value.ReplaceType(
    (cluster as text, optional database as text, optional table as text, optional options as record) =>
        _Kusto.Contents(cluster, database, table, valueOrDefault(options, [])), _Kusto.ContentsDocs);

[DataSource.Kind = "Kusto"]
shared Kusto.Databases = _Kusto.Databases;

Kusto =
[
    Type = "Singleton",
    MakeResourcePath = () => "Kusto",
    ParseResourcePath = (resource) => { },
    TestConnection = (resource) => {"() => true"},
    Authentication = [
        Aad = [
            AuthorizationUri = "https://login.microsoftonline.com/common/oauth2/authorize",
            Resource = "https://kusto.kusto.windows.net"
        ]
    ],
    Label = Extension.LoadString("Kusto.ResourceLabel")
];

Kusto.Publish =
[
    Category = "Azure",
    SupportsDirectQuery = true,
    ButtonText = { Extension.LoadString("Kusto.Contents.ButtonText"), Extension.LoadString("Kusto.Contents.ButtonTextHelp") },
    SourceImage = Kusto.Icons,
    SourceTypeImage = Kusto.Icons
];

Kusto.Icons = [
    Icon16 = { Extension.Contents("Kusto_16.png"), Extension.Contents("Kusto_20.png"), Extension.Contents("Kusto_24.png"), Extension.Contents("Kusto_32.png")},
    Icon32 = { Extension.Contents("Kusto_32.png"), Extension.Contents("Kusto_40.png"), Extension.Contents("Kusto_48.png"), Extension.Contents("Kusto_64.png") }
];

KQL.Icons = [
    Icon16 = { Extension.Contents("KQL_16.png"), Extension.Contents("KQL_20.png"), Extension.Contents("KQL_24.png"), Extension.Contents("KQL_32.png") },
    Icon32 = { Extension.Contents("KQL_32.png"), Extension.Contents("KQL_40.png"), Extension.Contents("KQL_48.png"), Extension.Contents("KQL_64.png") }
];

KqlDatabase.Publish =
[
    Category = "Fabric",
    SupportsDirectQuery = true,
    ButtonText = { Extension.LoadString("AzureDataExplorer.KqlDatabase.ButtonText"), Extension.LoadString("AzureDataExplorer.KqlDatabase.ButtonTextHelp") },
    SourceImage = KQL.Icons,
    SourceTypeImage = KQL.Icons,
    Beta = true
];

AadRedirectUrl = "https://oauth.powerbi.com/views/oauthredirect.html";
AadWorkspaceApiOAuthResource = Environment.FeatureSwitch("PowerBiAadResource", "https://analysis.windows.net/powerbi/api");

KqlDatabaseImpl = (optional cluster as text, optional database as text, optional table as text, optional options as record) =>
         if (cluster <> null) then _Kusto.Contents(cluster, database, table, options)
         else GetNavforWorkspaces();
     
kqlDatabase.Type =
    let
        clusterType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.Cluster.Name"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.Cluster.Sample") }
        ],
        databaseType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.Database.Name"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.Database.Sample") }
        ],
        tableOrQueryType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.TableOrQuery"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.TableOrQuery.Sample2"), Extension.LoadString("AzureDataExplorer.Contents.TableOrQuery.Sample1") },
            Formatting.IsMultiLine = true,
            Formatting.IsCode = true
        ],
        maxRowsType = type number meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.MaxRows"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.MaxRows.Sample") }
        ],
        maxSizeType = type number meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.MaxSize"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.MaxSize.Sample") }
        ],
        noTruncateType = type logical meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.NoTruncate"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.NoTruncate.Sample") }
        ],
        additionalSetStatementsType = type text meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.AdditionalSetStatements"),
            Documentation.SampleValues = { Extension.LoadString("AzureDataExplorer.Contents.AdditionalSetStatements.Sample") }
        ],

        _Kusto.OptionsRecord = type [
            optional MaxRows=maxRowsType, 
            optional MaxSize=maxSizeType, 
            optional NoTruncate=noTruncateType,
            optional AdditionalSetStatements=additionalSetStatementsType
        ] meta [
            Documentation.FieldCaption = Extension.LoadString("AzureDataExplorer.Contents.Options")
        ],
        t = type function (optional cluster as clusterType, optional database as databaseType, optional tableOrQuery as tableOrQueryType, optional options as _Kusto.OptionsRecord) as table
    in 
        t meta [
            Documentation.Description = Extension.LoadString("AzureDataExplorer.KqlDatabase.Function.Description"),
            Documentation.DisplayName = Extension.LoadString("AzureDataExplorer.KqlDatabase.Function.DisplayName"),
            Documentation.Caption = Extension.LoadString("AzureDataExplorer.KqlDatabase.Function.Caption"),
            Documentation.Name = Extension.LoadString("AzureDataExplorer.KqlDatabase.Function.Name"),
            Documentation.LongDescription = Extension.LoadString("AzureDataExplorer.KqlDatabase.Function.LongDescription"),
            Documentation.Examples = {[
                Description = Extension.LoadString("AzureDataExplorer.Contents.Examples.Description"),
                Code = Extension.LoadString("AzureDataExplorer.Contents.Examples.Code"),
                Result = Extension.LoadString("AzureDataExplorer.Contents.Examples.Result")
            ]}
        ];


GetClusterUrl = (baseUrl as text) =>
    let
        retryCountCodes = {500},
        maxRetryCount = 5,
        props = Extension.CurrentApplication(),
        serviceEndpoint = baseUrl,
        disco = Uri.Combine(serviceEndpoint, "/powerbi/globalservice/v201606/clusterdetails"),
        response = WebRequest(disco, [Headers = PBICommonHeaders(null,disco)]),
        clusterUrl = response[clusterUrl]
    in
        clusterUrl;  

PBICommonHeaders = (tenantId as nullable text, url as text) =>
    let
        newActivityId = Text.NewGuid(),
        loggedActivityId = Diagnostics.Trace(TraceLevel.Information, [Name="Request", Data=[], SafeData=[RequestId=newActivityId, Uri=url]], newActivityId),
        headers = [
            #"x-ms-client-request-id" = loggedActivityId,
            #"x-ms-client-session-id" = Diagnostics.ActivityId(),
            #"RequestId" = Diagnostics.ActivityId(),
            #"ActivityId" = newActivityId
        ],
        tenantIdHeaders = if tenantId <> null then [#"x-ms-tid" = tenantId] else []
    in
        headers & tenantIdHeaders;

GetNavforWorkspaces = () =>
    let
        PBIBaseUrl = Environment.FeatureSwitch("PowerBiUri", "https://api.powerbi.com"),
        apiurl = GetClusterUrl(PBIBaseUrl),
        clusterendpoint = Uri.Combine(apiurl,"/metadata/workspaces"),
        option =       [
                            Headers = [
                                       #"ActivityId" = Diagnostics.ActivityId(),
                                       #"RequestId" = Diagnostics.ActivityId(),
                                       #"x-ms-version" = "2020-12-06",
                                       #"Content-type" = "application/json"
                            ]
                        ],
        jsonResponse = WebRequest(clusterendpoint ,option),
        workspaces = Table.FromRecords(jsonResponse[folders], {"objectId", "displayName", "capacityObjectId"}, MissingField.UseNull),
        removedCapacityObjectColumns = Table.RemoveColumns(workspaces,"capacityObjectId"),
        rename = Table.RenameColumns(removedCapacityObjectColumns, {{"objectId", "workspaceId"}, { "displayName", "workspaceName"}}),
        withData = Table.AddColumn(rename,"Data", each GetKqlDatabases(apiurl,[workspaceId])),
         withItemKind = Table.AddColumn(withData,"ItemKind",each "Folder"),
        withItemName = Table.AddColumn(withItemKind,"ItemName",each "Folder"),
        withIsLeaf = Table.AddColumn(withItemName, "IsLeaf", each false), 
        // Build nav table
        navtable =  Table.NavigationTableView(
                    () => withItemName,
                    {"workspaceName"},
                    (workspaceId) => GetKqlDatabases(apiurl,workspaceId),
            [
                Name = "workspaceName",
                Data = each [Data],
                ItemKind = each [ItemKind],
                ItemName = each [ItemName],
                IsLeaf = each false
            ]
        )
     in
        navtable;

Table.ToNavigationTable = 
(
    table as table,
    keyColumns as list,
    nameColumn as text,
    dataColumn as text,
    itemKindColumn as text,
    itemNameColumn as text,
    isLeafColumn as text,
    optional tagsColumn as text
) as table =>
    let
        tableType = Value.Type(table),
        tableKeys = {[Columns=keyColumns, Primary=true]},
        newTableType = if tagsColumn <> null then Type.ReplaceTableKeys(tableType, tableKeys) meta 
        [
            NavigationTable.NameColumn = nameColumn, 
            NavigationTable.DataColumn = dataColumn,
            NavigationTable.TagsColumn = tagsColumn,
            NavigationTable.ItemKindColumn = itemKindColumn, 
            Preview.DelayColumn = itemNameColumn, 
            NavigationTable.IsLeafColumn = isLeafColumn
        ] else Type.ReplaceTableKeys(tableType, tableKeys) meta 
        [
            NavigationTable.NameColumn = nameColumn, 
            NavigationTable.DataColumn = dataColumn,
            NavigationTable.ItemKindColumn = itemKindColumn, 
            Preview.DelayColumn = itemNameColumn, 
            NavigationTable.IsLeafColumn = isLeafColumn
        ],
        navigationTable = Value.ReplaceType(table, newTableType)
    in
        navigationTable;
        
EnvironmentListType = Type.AddTableKey(
    type table [
        DisplayName = text,
        Name = text,
        Location = text,
        IsDefault = logical,
        Data = (type table meta [
            NavigationTable.ItemKind = "Database",
            Preview.Delay = "Table"
        ])
    ] meta [
        NavigationTable.NameColumn = "DisplayName",
        NavigationTable.DataColumn = "Data",
        NavigationTable.SupportsIndirection = true
    ],
    {"Name"},
    true);

GetKqlDatabases = (apiurl as text, workspaceId as text)  =>
    let
        url = Uri.Combine(apiurl, Text.Format("/metadata/workspaces/#{0}/artifacts", {workspaceId})),
        response = WebRequest(url,[]),
        locations = List.Transform(
            List.Select(
                response,
                each [artifactType] = "KustoDatabase"),
            each [
                   DisplayName = [displayName],
                   Name = [objectId],
                   Location = [extendedProperties][Region],
                   IsDefault = false,
                   Endpoint = [extendedProperties][QueryServiceUri],
                   Data = KustoClusterDetails(Endpoint)
            ]
        ),
        result = Table.Sort(
                Table.FromRecords(locations, EnvironmentListType),
                "DisplayName"
            )
    in
      result;

KustoClusterDetails = (cluster as text)  => 
    Table.View(null, [
    GetExpression = () => [
        Kind = "Invocation",
        Function = [Kind = "Constant", Value = AzureDataExplorer.Contents],
        Arguments = {[Kind = "Constant", Value = cluster]}
    ],
    GetType = () => type table [] ,
    GetRows = () => error Error.Record("DataSource.Error", "Error", null)
]);

[DataSource.Kind = "AzureDataExplorer", Publish = "AzureDataExplorer.Publish"]
shared AzureDataExplorer.Contents = Value.ReplaceType(
    (cluster as text, optional database as text, optional table as text, optional options as record) =>
        _Kusto.Contents(cluster, database, table, valueOrDefault(options, [])), _AzureDataExplorer.ContentsDocs);

// TODO: Consider removing AzureDataExplorer.Databases if we can ensure it won't break a large number of customers.
// The function's return value is equivalent to running:
// Table.ToRecords(Table.SelectColumns(AzureDataExplorer.Contents(<cluster>),{"Name", "ItemKind"}))
[DataSource.Kind = "AzureDataExplorer"]
shared AzureDataExplorer.Databases = _Kusto.Databases;

[DataSource.Kind = "AzureDataExplorer", Publish = "KqlDatabase.Publish"]
shared AzureDataExplorer.KqlDatabase = Value.ReplaceType(KqlDatabaseImpl, kqlDatabase.Type);

CurrentCloudEnvironment = Environment.FeatureSwitch("Cloud", "global");
PpeAuthorizationUri = "https://login.windows-ppe.net/common/oauth2/authorize";
PpeKustoResource = "https://kusto.kusto.windows.net";

ServerFromPath = (path) => if path = RootResourcePath  then null else path;
AadAuthorizationUri =  Uri.Combine(Environment.FeatureSwitch("AzureActiveDirectoryUri", "https://login.microsoftonline.com"), "/common/oauth2/authorize");
RootResourcePath = "AzureDataExplorer-a8b616a1-67bf-487e-898d-99c33d051900";
AzureDataExplorer =
[
    Type = "Custom",
    MakeResourcePath = (cluster) => cluster ?? RootResourcePath,
    ParseResourcePath = (resource) => { if resource = RootResourcePath then null else resource },
    TestConnection = (resource) => if resource = RootResourcePath then {"AzureDataExplorer.KqlDatabase", ServerFromPath(resource)} else {"AzureDataExplorer.Contents", ServerFromPath(resource)},
    Authentication = [
        Aad =  [
            AuthorizationUri = (resource) => if (resource =  RootResourcePath) then AadAuthorizationUri
                                             else if (CurrentCloudEnvironment  <> "ppe") then GetAuthorizationUrlFromWwwAuthenticate(resource) else PpeAuthorizationUri,
            Resource = (resource) => if (resource = RootResourcePath) then AadWorkspaceApiOAuthResource 
                                     else if (CurrentCloudEnvironment <> "ppe" ) then NormalizeResourceUrl(resource) else PpeKustoResource,
            DefaultClientApplication = [
 // Client Id for first party AAD. This ID we are using for PowerBI authentication flow.
                ClientId = "a672d62c-fc7b-4e81-a576-e60dc46e951d",
                ClientSecret = "",
                CallbackUrl = AadRedirectUrl
            ]
        ]
    ],
    IsKnownEndpoint = (resource) =>
        let
            normalizedUrl = if Text.StartsWith(resource, "https://", Comparer.FromCulture("en-us", true)) then resource 
                else if Text.StartsWith(resource, "http://", Comparer.FromCulture("en-us", true)) then error Error.Record("DataSource.Error", Extension.LoadString("Errors.HttpsOnly"))
                else ("https://" & resource & (if (Text.EndsWith(resource, ".kusto.windows.net") or Text.EndsWith(resource, ".kusto.azuresynapse.net")) then "" else ".kusto.windows.net")),
            hostname = Uri.Parts(normalizedUrl)[Host],
            isSupportedHostname = List.MatchesAny(SupportedUrlHostnames, (supportedHostname) => Text.EndsWith(hostname, supportedHostname[Prefix], Comparer.OrdinalIgnoreCase))
        in
            isSupportedHostname,
    Label = Extension.LoadString("AzureDataExplorer.ResourceLabel"),

    /*
     * valid DSRs
     *
     * {"protocol":"azure-data-explorer","address":{"cluster":null}}
     * {"protocol":"azure-data-explorer","address":{"cluster":"https://help.kusto.windows.net"}}
     * {"protocol":"azure-data-explorer","address":{"cluster":"https://help.kusto.windows.net","database":"Samples"}}
     * {"protocol":"azure-data-explorer","address":{"cluster":"https://help.kusto.windows.net","database":"Samples","entity":"StormEvents"}}
     * {"protocol":"azure-data-explorer","address":{"cluster":"help","database":"Samples"},"query":"StormEvents | project EpisodeId, State, EventType | limit 10"}}
     */
    // DSRs provide a product agnostic representation of a data source connection. While the Data Source Path value is
    // used to identify data source uniqueness (and the credential key), the DSR can contain additional information
    // (such as navigation table steps) that aren't relevant to the credential. Our products serialize the DSR in a JSON format.
    // Changes to the DSR must be reviewed by the Power Query Library Reviews alias.
    DSRHandlers = [
        #"azure-data-explorer" = [
            // Handles M Expression -> DSR record serialization
            GetDSR = (cluster, optional database, optional tableOrQuery, optional options, optional navigation) =>
                let
                    _database = database ?? navigation{0}?[Name]?,
                    query = tableOrQuery,
                    entity = 
                        if (database <> null) then
                            navigation{0}?[Name]?
                        else
                            navigation{2}?[Name]?
                in
                [
                    protocol = "azure-data-explorer",
                    address = [
                        cluster = cluster,
                        database = _database,
                        entity = entity
                    ],
                    query = query
                ],
            // Handles DSR record -> M translation.
            // Note: We can't roundtrip the AzureDataExplorer.Databases function as we have no way to differentiate
            // between it and AzureDataExplorer.Contents. Since it is unlikely to be used by customers, we've decided
            // to accept this limitation rather than removing the shared member entirely (and risk breaking existing reports).
            GetFormula = (dsr, optional options) => 
                let
                    address = dsr[address],
                    cluster = address[cluster]?,
                    database = address[database]?,
                    tableNavStep = address[entity]?,
                    query = dsr[query]?
                in
                    if (tableNavStep <> null) then
                        () => AzureDataExplorer.Contents(cluster, database, null, options){[Name=tableNavStep]}[Data]
                    else
                        () => AzureDataExplorer.Contents(cluster, database, query, options),

            GetFriendlyName = (dsr) => "Azure Data Explorer"
        ]
    ]
];

AzureDataExplorer.Publish =
[
    Category = "Azure",
    SupportsDirectQuery = true,
    ButtonText = { Extension.LoadString("AzureDataExplorer.Contents.ButtonText"), Extension.LoadString("AzureDataExplorer.Contents.ButtonTextHelp") },
    SourceImage = Kusto.Icons,
    SourceTypeImage = Kusto.Icons
];

AzureDataExplorer.Icons = [
    Icon16 = { Extension.Contents("Kusto_16.png"), Extension.Contents("Kusto_20.png"), Extension.Contents("Kusto_24.png"), Extension.Contents("Kusto_32.png")},
    Icon32 = { Extension.Contents("Kusto_32.png"), Extension.Contents("Kusto_40.png"), Extension.Contents("Kusto_48.png"), Extension.Contents("Kusto_64.png") }
];

// Extension library functions
Extension.LoadExpression = (name as text) =>
    let
        binary = Extension.Contents(name),
        asText = Text.FromBinary(binary)
    in
        Expression.Evaluate(asText, #shared);

Csv.FromValue = Extension.LoadExpression("Csv.FromValue.pqm");
Diagnostics = Extension.LoadExpression("Diagnostics.pqm");
Diagnostics.LogValue2 = Diagnostics[LogValue2];
Diagnostics.LogFailure = Diagnostics[LogFailure];
Diagnostics.WrapHandlers = Diagnostics[WrapHandlers];
Diagnostics.WrapHandlers2 = Diagnostics[WrapHandlers2];
FunctionParser = Extension.LoadExpression("FunctionParser.pqm");
SupportedUrlHostnames = Extension.LoadExpression("SupportedUrlHostnames.pqm");
Table.NavigationTableView = Extension.LoadExpression("Table.NavigationTableView.pqm");
Value.ToText = Diagnostics[ValueToText];
Value.WaitFor = Extension.LoadExpression("Value.WaitFor.pqm");

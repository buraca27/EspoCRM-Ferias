<div class="page-header">
    <div class="row">
        <div class="col-sm-7">
            <h2 class="page-title"><%= translate('Ferias') %></h2>
        </div>
        <div class="col-sm-5 text-right">
            <div class="btn-group">
                <button class="btn btn-primary" data-action="create" type="button">
                    <span class="glyphicon glyphicon-plus"></span>
                    <%= translate('Create') %>
                </button>
            </div>
        </div>
    </div>
</div>

<div class="search-container">
    <div class="row">
        <div class="col-sm-12">
            <div class="input-group">
                <input type="text" class="form-control search-field" placeholder="<%= translate('Search') %>">
                <span class="input-group-btn">
                    <button class="btn btn-default" type="button">
                        <i class="fas fa-search"></i>
                    </button>
                </span>
            </div>
        </div>
    </div>
</div>

<div class="filters-container">
    <div class="row">
        <div class="col-sm-12">
            <div class="btn-group btn-group-sm">
                <button class="btn btn-default filter-btn active">Todos</button>
                <button class="btn btn-default filter-btn">Este Mês</button>
                <button class="btn btn-default filter-btn">Este Ano</button>
            </div>
        </div>
    </div>
</div>

<div class="list-container">
    {{{content}}}
</div>

<style>
.page-header {
    margin: 20px 0 15px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid #e5e5e5;
}

.page-title {
    margin: 0;
    font-size: 28px;
    font-weight: 500;
    color: #222;
}

.search-container {
    margin: 15px 0;
    padding: 15px;
    background-color: #fafafa;
    border-radius: 4px;
}

.search-field {
    height: 38px;
    font-size: 14px;
}

.filters-container {
    margin: 15px 0;
    padding: 10px 0;
}

.filter-btn {
    padding: 8px 16px;
    margin-right: 8px;
    border-radius: 4px;
    font-size: 13px;
    border: 1px solid #ddd;
}

.filter-btn.active {
    background-color: #2196F3;
    color: white;
    border-color: #2196F3;
}

.list-container {
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
}
</style>
